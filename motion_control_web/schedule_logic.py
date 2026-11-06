"""Pure schedule rules for schedule_node (no ROS imports, unit-tested).

Config shape (stored as YAML, exchanged with the web UI as JSON):

    enabled: bool                       # schedule ON/OFF switch
    week:                               # one opening window per weekday
      mon: {enabled: bool, open: "HH:MM", close: "HH:MM"}
      ... tue wed thu fri sat sun
    playlist: [str, ...]                # motion CSV basenames, played in order
    motions_per_rest: {min: int, max: int}   # random N in [min, max] motions per rest
    rest_sec: {min: float, max: float}       # random rest length in [min, max] seconds
    overheat: {limit_c: float, resume_c: float, recheck_sec: float}
"""

from __future__ import annotations

import copy
import random
import re
from datetime import datetime, time
from typing import Any, Iterable

DAYS = ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')

DEFAULT_CONFIG: dict[str, Any] = {
    'enabled': False,
    'week': {
        day: {'enabled': True, 'open': '10:00', 'close': '22:00'}
        for day in DAYS
    },
    'playlist': [],
    'motions_per_rest': {'min': 1, 'max': 3},
    'rest_sec': {'min': 10.0, 'max': 10.0},
    'overheat': {'limit_c': 70.0, 'resume_c': 60.0, 'recheck_sec': 20.0},
}

_HHMM = re.compile(r'^([01]\d|2[0-3]):([0-5]\d)$')
_SAFE_FILE = re.compile(r'^[^/\\]+\.csv$')


def _parse_hhmm(value: Any, where: str) -> time:
    if not isinstance(value, str) or not _HHMM.match(value):
        raise ValueError(f'{where}: expected HH:MM, got {value!r}')
    hour, minute = value.split(':')
    return time(int(hour), int(minute))


def _number(value: Any, where: str, minimum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f'{where}: expected a number, got {value!r}')
    if value < minimum:
        raise ValueError(f'{where}: must be >= {minimum}, got {value}')
    return float(value)


def validate_config(raw: Any) -> dict[str, Any]:
    """Return a normalized copy of raw, or raise ValueError naming the bad field."""
    if not isinstance(raw, dict):
        raise ValueError('schedule must be an object')

    config = copy.deepcopy(DEFAULT_CONFIG)

    if 'enabled' in raw:
        if not isinstance(raw['enabled'], bool):
            raise ValueError('enabled: expected true/false')
        config['enabled'] = raw['enabled']

    week = raw.get('week', {})
    if not isinstance(week, dict):
        raise ValueError('week: expected an object')
    for day in DAYS:
        if day not in week:
            continue
        entry = week[day]
        if not isinstance(entry, dict):
            raise ValueError(f'week.{day}: expected an object')
        merged = {**config['week'][day], **entry}
        if not isinstance(merged['enabled'], bool):
            raise ValueError(f'week.{day}.enabled: expected true/false')
        opens = _parse_hhmm(merged['open'], f'week.{day}.open')
        closes = _parse_hhmm(merged['close'], f'week.{day}.close')
        if merged['enabled'] and closes <= opens:
            raise ValueError(f'week.{day}: close must be later than open')
        config['week'][day] = {
            'enabled': merged['enabled'],
            'open': merged['open'],
            'close': merged['close'],
        }

    playlist = raw.get('playlist', [])
    if not isinstance(playlist, list) or not all(
        isinstance(name, str) and _SAFE_FILE.match(name) for name in playlist
    ):
        raise ValueError('playlist: expected a list of motion .csv file names')
    config['playlist'] = list(playlist)

    for key, minimum in (('motions_per_rest', 1), ('rest_sec', 0)):
        entry = raw.get(key, config[key])
        if not isinstance(entry, dict):
            raise ValueError(f'{key}: expected {{min, max}}')
        low = _number(entry.get('min'), f'{key}.min', minimum)
        high = _number(entry.get('max'), f'{key}.max', minimum)
        if high < low:
            raise ValueError(f'{key}: max must be >= min')
        if key == 'motions_per_rest':
            if low != int(low) or high != int(high):
                raise ValueError('motions_per_rest: expected whole numbers')
            config[key] = {'min': int(low), 'max': int(high)}
        else:
            config[key] = {'min': low, 'max': high}

    overheat = raw.get('overheat', config['overheat'])
    if not isinstance(overheat, dict):
        raise ValueError('overheat: expected an object')
    limit_c = _number(overheat.get('limit_c'), 'overheat.limit_c', 0)
    resume_c = _number(overheat.get('resume_c'), 'overheat.resume_c', 0)
    recheck_sec = _number(overheat.get('recheck_sec'), 'overheat.recheck_sec', 1)
    if resume_c >= limit_c:
        raise ValueError('overheat: resume_c must be lower than limit_c')
    config['overheat'] = {
        'limit_c': limit_c,
        'resume_c': resume_c,
        'recheck_sec': recheck_sec,
    }

    return config


def is_open(config: dict[str, Any], now: datetime) -> bool:
    """True when now (local time) falls inside today's opening window."""
    day = config['week'][DAYS[now.weekday()]]
    if not day['enabled']:
        return False
    opens = _parse_hhmm(day['open'], 'open')
    closes = _parse_hhmm(day['close'], 'close')
    return opens <= now.time() < closes


def pick_motion_count(config: dict[str, Any], rng: random.Random) -> int:
    entry = config['motions_per_rest']
    return rng.randint(entry['min'], entry['max'])


def pick_rest_sec(config: dict[str, Any], rng: random.Random) -> float:
    entry = config['rest_sec']
    return round(rng.uniform(entry['min'], entry['max']), 1)


def is_overheated(config: dict[str, Any], temperatures: Iterable[float]) -> bool:
    return max(temperatures, default=0.0) >= config['overheat']['limit_c']


def is_cooled(config: dict[str, Any], temperatures: Iterable[float]) -> bool:
    return max(temperatures, default=0.0) < config['overheat']['resume_c']


def stop_progress_threshold(move_duration_sec: float) -> float:
    """Progress at which to send STOP so a looping MOVE ends on its last frame.

    RobotManager restarts MOVE from frame 0 when progress reaches 1.0, so STOP
    is sent ~0.15 s early to land before the wrap rather than just after it.
    """
    if move_duration_sec <= 0:
        return 0.995
    return 1.0 - min(0.01, 0.15 / move_duration_sec)
