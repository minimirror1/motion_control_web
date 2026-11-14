"""Weekly opening-hours scheduler for the motion object.

Cycle while the store is open:
  torque ON -> [switch active motion] -> reload config -> MOVE ... STOP
  (repeat for a random 1..N motions) -> torque OFF -> log temperatures ->
  rest a random time in [rest_sec.min, rest_sec.max] -> (overheat: keep
  resting, re-measure every recheck_sec until below resume_c) -> repeat.
At closing time the running motion finishes, then torque goes OFF.

The reload before every MOVE resets RobotManager's resume point, so each
motion plays from its first frame (no move-to-start blend; the object is
fine jumping straight to it).
Motion actions go through control_gateway_node's privileged schedule topic
(web-origin commands are blocked there while the schedule is ON). Torque is
switched directly on motion_control/request, the same topic RobotManagerNode
uses, so it works even when RobotManagerNode has not latched a valid status.
"""

from __future__ import annotations

import json
import os
import random
import time
from collections import deque
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable

import rclpy
import yaml
from motion_control_msgs.msg import MotorStatus, RobotState
from motion_control_msgs.srv import (
    GetSchedule,
    GetTemperatureLog,
    ListTemperatureLogs,
    SetActiveMotion,
    SetSchedule,
)
from rclpy.node import Node
from rclpy.qos import (
    QoSDurabilityPolicy,
    QoSHistoryPolicy,
    QoSProfile,
    QoSReliabilityPolicy,
)
from std_msgs.msg import Bool, Int8MultiArray, String, UInt8
from std_srvs.srv import Trigger

from motion_control_web import schedule_logic as logic
from motion_control_web.temperature_log import TemperatureLog, write_atomic

COMMAND_PLAY_MOTION = 2
COMMAND_STOP_MOTION = 3

ROBOT_STATE_STOPPED = 1
ROBOT_STATE_OPERATING = 2

REQUEST_DISABLE = 0
REQUEST_ENABLE = 1
REQUEST_KEEP = 2

STATUS_STALE_SEC = 2.0
RETRY_SEC = 2.0
ERROR_BACKOFF_SEC = 30.0
TORQUE_TIMEOUT_SEC = 10.0
STOP_TIMEOUT_SEC = 10.0
HISTORY_SIZE = 6
SERVICE_TIMEOUT_SEC = 15.0

FILES_DIR = os.environ.get(
    'MOTION_SYSTEM_FILES_DIR', os.path.expanduser('~/colcon_ws/files'))


class Phase(str, Enum):
    DISABLED = 'disabled'          # schedule switch OFF
    WAITING = 'waiting'            # no motor/robot status or clock not valid yet
    CLOSED = 'closed'              # outside opening hours, torque OFF
    ENABLING = 'enabling'          # torque ON requested
    SELECTING = 'selecting'        # switching the motion file / reloading config
    PLAYING = 'playing'
    STOPPING = 'stopping'
    DISABLING = 'disabling'        # torque OFF requested
    RESTING = 'resting'
    COOLING = 'cooling'            # overheat: rest extended
    ERROR = 'error'


class ScheduleNode(Node):
    QOS_BEST_EFFORT = QoSProfile(
        reliability=QoSReliabilityPolicy.BEST_EFFORT,
        history=QoSHistoryPolicy.KEEP_LAST,
        depth=1,
        durability=QoSDurabilityPolicy.VOLATILE,
    )
    QOS_LATCHED = QoSProfile(
        reliability=QoSReliabilityPolicy.RELIABLE,
        history=QoSHistoryPolicy.KEEP_LAST,
        depth=1,
        durability=QoSDurabilityPolicy.TRANSIENT_LOCAL,
    )

    def __init__(self):
        super().__init__('schedule_node')

        self.schedule_file = Path(self.declare_parameter(
            'schedule_file', os.path.join(FILES_DIR, 'schedule', 'schedule.yaml')).value)
        self.robot_config_file = Path(self.declare_parameter(
            'robot_config_file',
            os.path.join(FILES_DIR, 'robot_manager', 'active_robot_manager.yaml')).value)
        log_dir = self.declare_parameter(
            'temperature_log_dir', os.path.join(FILES_DIR, 'logs', 'temperature')).value
        retention_days = int(self.declare_parameter('log_retention_days', 90).value)

        self.temperature_log = TemperatureLog(log_dir, retention_days)
        self.rng = random.Random()
        self.config = self._load_config()

        self.command_publisher = self.create_publisher(
            UInt8, 'motion_control_web/schedule_control_command', 10)
        self.request_publisher = self.create_publisher(
            Int8MultiArray, 'motion_control/request', self.QOS_BEST_EFFORT)
        self.active_publisher = self.create_publisher(
            Bool, 'motion_control_web/schedule_active', self.QOS_LATCHED)
        self.status_publisher = self.create_publisher(
            String, 'motion_control_web/schedule_status', self.QOS_LATCHED)

        self.create_subscription(
            RobotState, 'motion_control/robot_state', self._on_robot_state,
            self.QOS_BEST_EFFORT)
        self.create_subscription(
            MotorStatus, 'motion_control/motor_status', self._on_motor_status,
            self.QOS_BEST_EFFORT)

        self.set_active_client = self.create_client(
            SetActiveMotion, '/motion_control_teach_node/set_active_motion')
        self.reload_client = self.create_client(
            Trigger, '/robot_manager_node/reload_config')

        self.create_service(GetSchedule, '~/get_schedule', self._on_get_schedule)
        self.create_service(SetSchedule, '~/set_schedule', self._on_set_schedule)
        self.create_service(
            ListTemperatureLogs, '~/list_temperature_logs', self._on_list_logs)
        self.create_service(
            GetTemperatureLog, '~/get_temperature_log', self._on_get_log)

        # Latest feedback.
        self.robot_state: int | None = None
        self.robot_progress = 0.0
        self.robot_state_at = -1e9
        self.motor_ids: list[int] = []
        self.statuswords: list[int] = []
        self.errorcodes: list[int] = []
        self.temperatures: list[float] = []
        # Motors left out after a failed torque ON: id -> {reason, since}.
        # Cleared when the user switches the schedule OFF and ON again.
        self.excluded: dict[int, dict[str, str]] = {}
        self.motor_status_at = -1e9

        # Cycle bookkeeping.
        self.phase = Phase.WAITING
        self.phase_at = time.monotonic()
        self.last_sent_at = -1e9
        self.after_disable = Phase.CLOSED
        self.motions_left = 0
        self.playlist_index = 0
        self.active_motion: str | None = None
        self.seen_moving = False
        self.last_progress = 0.0
        self.stop_threshold = 0.995
        self.rest_until = 0.0
        self.next_check_at = 0.0
        self.overheated = False
        self.pending_call = None
        self.enforce_off_until = 0.0
        self.last_error = ''
        self.last_log: dict[str, Any] | None = None
        self.last_purge_day = None
        # Timeline for the web UI: finished steps, the step in progress.
        self.history: deque[dict[str, Any]] = deque(maxlen=HISTORY_SIZE)
        self.current_step: dict[str, Any] | None = None
        self.play_started_at = 0.0
        self.play_duration = 0.0

        self._publish_active()
        self.create_timer(0.1, self._tick)
        self.create_timer(1.0, self._publish_status)
        self.get_logger().info(
            f'schedule_node up: schedule={self.schedule_file} '
            f'enabled={self.config["enabled"]} tz={_tz_name()}')

    # ------------------------------------------------------------------ config

    def _load_config(self) -> dict[str, Any]:
        try:
            raw = yaml.safe_load(self.schedule_file.read_text(encoding='utf-8')) or {}
            return logic.validate_config(raw)
        except FileNotFoundError:
            config = logic.validate_config({})
            self._save_config(config)
            return config
        except (OSError, ValueError, yaml.YAMLError) as e:
            self.get_logger().error(
                f'invalid schedule file {self.schedule_file}: {e}; schedule disabled')
            return logic.validate_config({})

    def _save_config(self, config: dict[str, Any]) -> None:
        write_atomic(
            self.schedule_file,
            yaml.safe_dump(config, sort_keys=False, allow_unicode=True))

    def _read_move_duration(self) -> float:
        try:
            root = yaml.safe_load(self.robot_config_file.read_text(encoding='utf-8'))
            return float(root['robot'][0]['move_duration'])
        except Exception as e:  # noqa: BLE001 - fall back to a fixed threshold
            self.get_logger().warning(f'cannot read move_duration: {e}')
            return 0.0

    def _read_active_motion(self) -> str | None:
        try:
            root = yaml.safe_load(self.robot_config_file.read_text(encoding='utf-8'))
            return str(root['robot'][0]['motion_data_file_path'])
        except Exception:  # noqa: BLE001
            return None

    # --------------------------------------------------------------- services

    def _on_get_schedule(self, request, response):
        response.success = True
        response.message = ''
        response.schedule_json = json.dumps(self.config)
        response.timezone = _tz_name()
        return response

    def _on_set_schedule(self, request, response):
        try:
            config = logic.validate_config(json.loads(request.schedule_json))
            self._save_config(config)
        except (ValueError, OSError) as e:
            response.success = False
            response.message = str(e)
            return response
        if config['enabled'] and not self.config['enabled'] and self.excluded:
            self.get_logger().info(
                f'schedule switched ON: rechecking excluded motors {sorted(self.excluded)}')
            self.excluded.clear()
        self.config = config
        self._publish_active()
        response.success = True
        response.message = 'schedule saved'
        self.get_logger().info(f'schedule updated: enabled={config["enabled"]}')
        return response

    def _on_list_logs(self, request, response):
        response.success = True
        response.message = ''
        response.dates = self.temperature_log.list_dates()
        return response

    def _on_get_log(self, request, response):
        try:
            response.csv_text = self.temperature_log.read(request.date)
            response.success = True
            response.message = ''
        except (ValueError, OSError) as e:
            response.success = False
            response.message = str(e)
        return response

    # --------------------------------------------------------------- feedback

    def _on_robot_state(self, msg: RobotState) -> None:
        if not msg.state:
            return
        self.robot_state = int(msg.state[0])
        self.robot_progress = float(msg.progress[0]) if msg.progress else 0.0
        self.robot_state_at = time.monotonic()

        # End-of-motion detection runs here (100 Hz) rather than in the 10 Hz
        # tick so STOP lands before RobotManager wraps MOVE back to frame 0.
        if self.phase != Phase.PLAYING:
            return
        if self.robot_state == ROBOT_STATE_OPERATING:
            self.seen_moving = True
            wrapped = self.robot_progress < self.last_progress - 0.5
            if self.robot_progress >= self.stop_threshold or wrapped:
                self._finish_motion()
            self.last_progress = self.robot_progress
        elif self.seen_moving and self.robot_state == ROBOT_STATE_STOPPED:
            # Stopped by someone else; treat as the end of this motion.
            self._finish_motion()

    def _on_motor_status(self, msg: MotorStatus) -> None:
        self.motor_ids = [int(i) for i in msg.controller_index]
        self.statuswords = [int(s) for s in msg.statusword]
        self.errorcodes = [int(e) for e in msg.errorcode]
        self.temperatures = [float(t) for t in msg.temperature]
        self.motor_status_at = time.monotonic()

    def _status_fresh(self) -> bool:
        now = time.monotonic()
        return (
            now - self.motor_status_at < STATUS_STALE_SEC
            and now - self.robot_state_at < STATUS_STALE_SEC
            and bool(self.motor_ids)
        )

    def _torque_all(self, on: bool) -> bool:
        """ON: every motor still in use has torque. OFF: no motor has torque."""
        if not self.statuswords:
            return False
        if on:
            enabled, disabled = logic.split_torque_result(
                self.motor_ids, self.statuswords, self.excluded)
            return bool(enabled) and not disabled
        return all(s == 0 for s in self.statuswords)

    # --------------------------------------------------------------- commands

    def _send(self, command: int) -> None:
        self.command_publisher.publish(UInt8(data=command))
        self.last_sent_at = time.monotonic()

    def _request_torque(self, on: bool) -> None:
        if not self.motor_ids:
            return
        data = [REQUEST_KEEP] * (max(self.motor_ids) + 1)
        for i in self.motor_ids:
            # Excluded motors stay OFF so motor_manager stops retrying them.
            data[i] = REQUEST_ENABLE if on and i not in self.excluded else REQUEST_DISABLE
        self.request_publisher.publish(Int8MultiArray(data=data))
        self.last_sent_at = time.monotonic()

    def _enter(self, phase: Phase) -> None:
        if phase != self.phase:
            self.get_logger().info(f'phase: {self.phase.value} -> {phase.value}')
        self.phase = phase
        self.phase_at = time.monotonic()

    def _elapsed(self) -> float:
        return time.monotonic() - self.phase_at

    def _set_step(self, kind: str, label: str, detail: str = '') -> None:
        """Start a new timeline step; the previous one moves to history."""
        now = _now_iso()
        if self.current_step is not None:
            self.current_step.setdefault('end', now)
            self.history.append(self.current_step)
        self.current_step = {'kind': kind, 'label': label, 'detail': detail, 'start': now}

    def _since_sent(self) -> float:
        return time.monotonic() - self.last_sent_at

    def _fail(self, reason: str) -> None:
        self.last_error = f'{datetime.now().isoformat(timespec="seconds")} {reason}'
        self.get_logger().error(f'schedule error: {reason}')
        self.pending_call = None
        self._begin_enforce_off()
        self._set_step('error', reason)
        self._enter(Phase.ERROR)

    def _begin_enforce_off(self) -> None:
        self._send(COMMAND_STOP_MOTION)
        self._request_torque(False)
        self.enforce_off_until = time.monotonic() + TORQUE_TIMEOUT_SEC

    def _enforce_off(self) -> None:
        """Repeat STOP + torque OFF until both are confirmed.

        A single request can be lost, and while RobotManager is still playing
        its motor commands switch torque back ON, so STOP must land as well.
        """
        if time.monotonic() > self.enforce_off_until:
            return
        if self.robot_state == ROBOT_STATE_STOPPED and self._torque_all(False):
            self.enforce_off_until = 0.0
        elif self._since_sent() > RETRY_SEC:
            self._send(COMMAND_STOP_MOTION)
            self._request_torque(False)

    # ------------------------------------------------------------------ cycle

    def _tick(self) -> None:
        now = datetime.now()
        self._purge_logs_daily(now)

        if not self.config['enabled']:
            if self.phase != Phase.DISABLED:
                self._shutdown_cycle()
                self._set_step('disabled', '스케줄 꺼짐')
                self._enter(Phase.DISABLED)
            self._enforce_off()
            return

        if self.phase == Phase.DISABLED:
            self._enter(Phase.WAITING)

        if self.phase in (Phase.WAITING, Phase.CLOSED, Phase.ERROR):
            self._enforce_off()
            self._tick_idle(now)
            return

        handler: dict[Phase, Callable[[datetime], None]] = {
            Phase.ENABLING: self._tick_enabling,
            Phase.SELECTING: self._tick_selecting,
            Phase.PLAYING: self._tick_playing,
            Phase.STOPPING: self._tick_stopping,
            Phase.DISABLING: self._tick_disabling,
            Phase.RESTING: self._tick_resting,
            Phase.COOLING: self._tick_cooling,
        }
        handler[self.phase](now)

    def _shutdown_cycle(self) -> None:
        """Schedule switched OFF: stop any motion and drop torque."""
        if self.phase != Phase.WAITING:
            self._begin_enforce_off()
        self.pending_call = None
        self.get_logger().info('schedule switched OFF')

    def _tick_idle(self, now: datetime) -> None:
        if self.phase == Phase.ERROR and self._elapsed() < ERROR_BACKOFF_SEC:
            return
        if not self._status_fresh() or now.year < 2025:
            self._enter(Phase.WAITING)
            return
        if self.robot_state != ROBOT_STATE_STOPPED:
            # e.g. this node restarted mid-motion: stop before anything else.
            if self._since_sent() > RETRY_SEC:
                self._send(COMMAND_STOP_MOTION)
            return
        if logic.is_open(self.config, now):
            self._start_cycle()
            return
        if self.phase != Phase.CLOSED:
            self._enter_closed()
        # Keep torque OFF while closed.
        if not self._torque_all(False) and self._since_sent() > RETRY_SEC:
            self._request_torque(False)

    def _start_cycle(self) -> None:
        self.motions_left = logic.pick_motion_count(self.config, self.rng)
        self.get_logger().info(f'cycle: {self.motions_left} motion(s) before next rest')
        self._request_torque(True)
        self._enter(Phase.ENABLING)

    def _tick_enabling(self, now: datetime) -> None:
        if self._torque_all(True):
            self._next_motion(now)
        elif self._elapsed() > TORQUE_TIMEOUT_SEC:
            enabled, failed = logic.split_torque_result(
                self.motor_ids, self.statuswords, self.excluded)
            if not enabled:
                self._fail(f'torque ON timed out (모터 {self._ids_text(failed)})')
                return
            self._exclude(failed)
            self._request_torque(True)  # turns the excluded motors OFF again
            self._next_motion(now)
        elif self._since_sent() > RETRY_SEC:
            self._request_torque(True)

    def _exclude(self, motor_ids: list[int]) -> None:
        """Leave motors that won't take torque out; run with the rest."""
        since = datetime.now().isoformat(timespec='seconds')
        errors = dict(zip(self.motor_ids, self.errorcodes))
        reasons = []
        for motor_id in motor_ids:
            reason = logic.describe_hardware_error(errors.get(motor_id, 0)) or '토크 ON 응답 없음'
            self.excluded[motor_id] = {'reason': reason, 'since': since}
            reasons.append(f'모터 {motor_id}: {reason}')
        ids = self._ids_text(motor_ids)
        self.last_error = f'{since} 모터 {ids} 토크 ON 실패 → 제외하고 나머지 모터로 진행'
        self.get_logger().warning(
            f'torque ON failed for motor(s) {ids} ({"; ".join(reasons)}); '
            'excluded until the schedule is switched OFF and ON')
        self._set_step('error', f'모터 {ids} 제외', '; '.join(reasons))

    @staticmethod
    def _ids_text(motor_ids: list[int]) -> str:
        return ', '.join(str(i) for i in motor_ids)

    def _next_motion(self, now: datetime) -> None:
        if not logic.is_open(self.config, now):
            self._begin_disable(Phase.CLOSED)
            return
        playlist = self.config['playlist']
        if self.active_motion is None:
            self.active_motion = self._read_active_motion()
        target = playlist[self.playlist_index % len(playlist)] if playlist else None
        self._set_step('motion', target or self.active_motion or '활성 모션')
        self._enter(Phase.SELECTING)
        if target is None or target == self.active_motion:
            self._begin_reload(target or self.active_motion)
            return
        if not self.set_active_client.service_is_ready():
            self._fail('motion_control_teach_node/set_active_motion unavailable')
            return
        self.get_logger().info(f'switching active motion -> {target}')
        self.pending_call = ('set_active', target, self.set_active_client.call_async(
            SetActiveMotion.Request(file_name=target)))

    def _tick_selecting(self, now: datetime) -> None:
        if self.pending_call is None:
            return
        step, target, future = self.pending_call
        if not future.done():
            if self._elapsed() > SERVICE_TIMEOUT_SEC:
                self._fail(f'{step} timed out')
            return
        result = future.result()
        if result is None or not result.success:
            self._fail(f'{step} failed: {getattr(result, "message", "no response")}')
            return
        if step == 'set_active':
            self._begin_reload(target)
            return
        self.pending_call = None
        self.active_motion = target
        self._begin_play()

    def _begin_reload(self, target: str | None) -> None:
        # Reloading rebuilds RobotManager, so the next MOVE starts at frame 0
        # instead of resuming where the previous STOP left off.
        if not self.reload_client.service_is_ready():
            self._fail('robot_manager_node/reload_config unavailable')
            return
        self.pending_call = ('reload', target, self.reload_client.call_async(
            Trigger.Request()))
        self.phase_at = time.monotonic()

    def _begin_play(self) -> None:
        duration = self._read_move_duration()
        self.stop_threshold = logic.stop_progress_threshold(duration)
        self.play_timeout = (duration if duration > 0 else 600.0) * 1.5 + 30.0
        self.play_started_at = time.monotonic()
        self.play_duration = duration
        self.seen_moving = False
        self.last_progress = 0.0
        self._send(COMMAND_PLAY_MOTION)
        self._enter(Phase.PLAYING)

    def _tick_playing(self, now: datetime) -> None:
        # Completion is detected in _on_robot_state; this only guards timeouts.
        if self._elapsed() > self.play_timeout:
            self._fail('motion did not finish in time')
        elif not self.seen_moving and self._since_sent() > RETRY_SEC:
            # reload_config resets RobotManager's status latch, so the first
            # PLAY can be dropped; retry a few times.
            if self._elapsed() > 3 * RETRY_SEC:
                self._fail('motion did not start')
            else:
                self._send(COMMAND_PLAY_MOTION)

    def _finish_motion(self) -> None:
        if self.current_step is not None:
            self.current_step['end'] = _now_iso()
        self._send(COMMAND_STOP_MOTION)
        self.motions_left -= 1
        self.playlist_index += 1
        self._enter(Phase.STOPPING)

    def _tick_stopping(self, now: datetime) -> None:
        if self.robot_state == ROBOT_STATE_STOPPED:
            if not logic.is_open(self.config, now):
                self._begin_disable(Phase.CLOSED)
            elif self.motions_left <= 0:
                self._begin_disable(Phase.RESTING)
            else:
                self._next_motion(now)
        elif self._elapsed() > STOP_TIMEOUT_SEC:
            self._fail('stop timed out')
        elif self._since_sent() > RETRY_SEC:
            self._send(COMMAND_STOP_MOTION)

    def _begin_disable(self, after: Phase) -> None:
        self.after_disable = after
        self._request_torque(False)
        self._enter(Phase.DISABLING)

    def _tick_disabling(self, now: datetime) -> None:
        if self._torque_all(False):
            if self.after_disable == Phase.RESTING:
                self._begin_rest(now)
            else:
                self._enter_closed()
        elif self._elapsed() > TORQUE_TIMEOUT_SEC:
            self._fail('torque OFF timed out')
        elif self._since_sent() > RETRY_SEC:
            self._request_torque(False)

    def _begin_rest(self, now: datetime) -> None:
        temperatures = self._log_temperatures(now, 'rest')
        rest_sec = logic.pick_rest_sec(self.config, self.rng)
        self.overheated = logic.is_overheated(self.config, temperatures)
        self.rest_until = time.monotonic() + rest_sec
        self.get_logger().info(
            f'rest {rest_sec:g}s, temperatures={temperatures}'
            + (' (overheat: rest extended)' if self.overheated else ''))
        self._set_step('rest', f'{rest_sec:g}초', _temps_text(temperatures))
        self._enter(Phase.RESTING)

    def _enter_closed(self) -> None:
        self._set_step('closed', '영업시간 외')
        self._enter(Phase.CLOSED)

    def _tick_resting(self, now: datetime) -> None:
        if not logic.is_open(self.config, now):
            self._enter_closed()
        elif time.monotonic() >= self.rest_until:
            if self.overheated:
                self.next_check_at = time.monotonic() + self.config['overheat']['recheck_sec']
                resume_c = self.config['overheat']['resume_c']
                self._set_step('cooling', f'{resume_c:g}℃ 미만이 될 때까지 연장',
                               _temps_text(self.temperatures))
                self._enter(Phase.COOLING)
            else:
                self._start_cycle()

    def _tick_cooling(self, now: datetime) -> None:
        if not logic.is_open(self.config, now):
            self._enter_closed()
            return
        if time.monotonic() < self.next_check_at:
            return
        temperatures = self._log_temperatures(now, 'overheat_recheck')
        if self.current_step is not None:
            self.current_step['detail'] = _temps_text(temperatures)
        if logic.is_cooled(self.config, temperatures):
            self.overheated = False
            self._start_cycle()
        else:
            self.next_check_at = time.monotonic() + self.config['overheat']['recheck_sec']

    # -------------------------------------------------------------------- log

    def _log_temperatures(self, now: datetime, event: str) -> list[float]:
        temperatures = list(self.temperatures)
        try:
            self.temperature_log.append(now.astimezone(), event, self.motor_ids, temperatures)
        except OSError as e:
            self.get_logger().error(f'temperature log write failed: {e}')
        self.last_log = {
            'timestamp': now.isoformat(timespec='seconds'),
            'event': event,
            'temperatures': temperatures,
        }
        return temperatures

    def _purge_logs_daily(self, now: datetime) -> None:
        if self.last_purge_day == now.date():
            return
        self.last_purge_day = now.date()
        try:
            deleted = self.temperature_log.purge(now.date())
        except OSError as e:
            self.get_logger().error(f'temperature log purge failed: {e}')
            return
        if deleted:
            self.get_logger().info(f'purged temperature logs: {deleted}')

    # ----------------------------------------------------------------- status

    def _publish_active(self) -> None:
        self.active_publisher.publish(Bool(data=bool(self.config['enabled'])))

    def _publish_status(self) -> None:
        now = datetime.now()
        rest_remaining = None
        if self.phase == Phase.RESTING:
            rest_remaining = max(0.0, self.rest_until - time.monotonic())
        elif self.phase == Phase.COOLING:
            rest_remaining = max(0.0, self.next_check_at - time.monotonic())
        status = {
            'phase': self.phase.value,
            'enabled': self.config['enabled'],
            'open_now': logic.is_open(self.config, now),
            'now': now.astimezone().isoformat(timespec='seconds'),
            'timezone': _tz_name(),
            'active_motion': self.active_motion,
            'motions_left': self.motions_left,
            'rest_remaining_sec': rest_remaining,
            'overheated': self.overheated,
            'temperatures': self.temperatures,
            'motor_ids': self.motor_ids,
            'errorcodes': self.errorcodes,
            'excluded_motors': [
                {'id': motor_id, **info} for motor_id, info in sorted(self.excluded.items())
            ],
            'last_log': self.last_log,
            'last_error': self.last_error,
            'motion': self._motion_progress(),
            'timeline': {
                'past': list(self.history),
                'current': self.current_step,
                'future': self._future_steps(now),
            },
        }
        self.status_publisher.publish(String(data=json.dumps(status)))


    def _motion_progress(self) -> dict[str, Any] | None:
        if self.phase not in (Phase.PLAYING, Phase.STOPPING) or self.current_step is None:
            return None
        finished = self.phase == Phase.STOPPING
        elapsed = time.monotonic() - self.play_started_at
        if self.play_duration > 0:
            elapsed = min(elapsed, self.play_duration)
        return {
            'name': self.current_step['label'],
            'progress': 1.0 if finished else max(0.0, min(1.0, self.robot_progress)),
            'elapsed_sec': self.play_duration if finished else elapsed,
            'duration_sec': self.play_duration,
        }

    def _future_steps(self, now: datetime) -> list[dict[str, Any]]:
        """What comes next, as far as it is known (motion counts are random)."""
        if not self.config['enabled']:
            return []
        closes = logic.closing_time(self.config, now)
        if closes is None:
            opens = logic.next_open(self.config, now)
            return [{
                'kind': 'open', 'label': '스케줄 자동 시작',
                'detail': '', 'start': opens.astimezone().isoformat(timespec='seconds') if opens else None,
            }] if opens else []

        playlist = self.config['playlist']

        def name(offset: int) -> str:
            if playlist:
                return playlist[(self.playlist_index + offset) % len(playlist)]
            return self.active_motion or '활성 모션'

        counts = self.config['motions_per_rest']
        count_text = (f'{counts["min"]}개' if counts['min'] == counts['max']
                      else f'{counts["min"]}~{counts["max"]}개 무작위')
        rest = self.config['rest_sec']
        rest_text = (f'{rest["min"]:g}초' if rest['min'] == rest['max']
                     else f'{rest["min"]:g}~{rest["max"]:g}초 무작위')

        steps: list[dict[str, Any]] = []
        if self.phase in (Phase.SELECTING, Phase.PLAYING):
            first, remaining = 1, self.motions_left - 1
        elif self.phase in (Phase.ENABLING, Phase.STOPPING, Phase.DISABLING):
            first, remaining = 0, self.motions_left
        else:  # resting, cooling, waiting, error: a new cycle comes next
            steps.append({'kind': 'motion', 'label': name(0),
                          'detail': f'다음 사이클 {count_text}'})
            first, remaining = 1, 0
        for i in range(max(0, remaining)):
            steps.append({'kind': 'motion', 'label': name(first + i), 'detail': ''})
        steps.append({'kind': 'rest', 'label': rest_text, 'detail': '휴게 중 온도 기록'})
        steps.append({'kind': 'close', 'label': '재생 중 모션을 마친 뒤 토크 OFF', 'detail': '',
                      'start': closes.astimezone().isoformat(timespec='seconds')})
        return steps


def _now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec='seconds')


def _temps_text(temperatures: list[float]) -> str:
    return ' / '.join(f'{t:g}℃' for t in temperatures)


def _tz_name() -> str:
    # /etc/localtime is what the clock actually uses; /etc/timezone can be stale.
    target = os.path.realpath('/etc/localtime')
    if 'zoneinfo/' in target:
        return target.split('zoneinfo/', 1)[1]
    return datetime.now().astimezone().tzname() or ''


def main(args=None):
    rclpy.init(args=args)
    node = ScheduleNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()
