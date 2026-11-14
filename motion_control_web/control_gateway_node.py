import math
import time

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSDurabilityPolicy, QoSProfile, QoSReliabilityPolicy
from sensor_msgs.msg import Joy
from std_msgs.msg import Bool, UInt8


COMMAND_ENABLE_MOTORS = 1
COMMAND_PLAY_MOTION = 2
COMMAND_STOP_MOTION = 3
COMMAND_HOME = 4
COMMAND_DISABLE_MOTORS = 5
COMMAND_MOVE_TO_START = 6

JOY_BUTTON_CROSS = 0
JOY_BUTTON_CIRCLE = 1
JOY_BUTTON_TRIANGLE = 2
JOY_BUTTON_SQUARE = 3
JOY_BUTTON_L1 = 6
JOY_BUTTON_START = 9
JOY_BUTTON_COUNT = 10

COMMAND_BUTTONS = {
    COMMAND_ENABLE_MOTORS: JOY_BUTTON_START,
    COMMAND_PLAY_MOTION: JOY_BUTTON_CIRCLE,
    COMMAND_STOP_MOTION: JOY_BUTTON_SQUARE,
    COMMAND_HOME: JOY_BUTTON_TRIANGLE,
    COMMAND_DISABLE_MOTORS: JOY_BUTTON_CROSS,
    COMMAND_MOVE_TO_START: JOY_BUTTON_L1,
}

COMMAND_NAMES = {
    COMMAND_ENABLE_MOTORS: 'enable_motors',
    COMMAND_PLAY_MOTION: 'play_motion',
    COMMAND_STOP_MOTION: 'stop_motion',
    COMMAND_HOME: 'home',
    COMMAND_DISABLE_MOTORS: 'disable_motors',
    COMMAND_MOVE_TO_START: 'move_to_start',
}


class ControlGatewayNode(Node):
    """Allowlisted web commands translated to the existing joystick interface."""

    def __init__(self):
        super().__init__('control_gateway_node')

        self.declare_parameter(
            'input_topic',
            'motion_control_web/control_command',
        )
        self.declare_parameter('output_topic', 'joy')
        self.declare_parameter(
            'schedule_input_topic',
            'motion_control_web/schedule_control_command',
        )
        self.declare_parameter(
            'schedule_active_topic',
            'motion_control_web/schedule_active',
        )
        self.declare_parameter('min_command_interval_sec', 0.25)
        self.declare_parameter('button_hold_sec', 0.1)

        self.input_topic = self.get_parameter('input_topic').value
        self.output_topic = self.get_parameter('output_topic').value
        self.min_command_interval_sec = float(
            self.get_parameter('min_command_interval_sec').value
        )
        self.button_hold_sec = float(
            self.get_parameter('button_hold_sec').value
        )

        self.joy_publisher = self.create_publisher(Joy, self.output_topic, 10)
        self.command_subscription = self.create_subscription(
            UInt8,
            self.input_topic,
            self._on_command,
            10,
        )
        # While schedule_node runs the schedule, only its own topic may drive
        # the robot; web-origin commands are dropped.
        self.schedule_active = False
        self.schedule_command_subscription = self.create_subscription(
            UInt8,
            self.get_parameter('schedule_input_topic').value,
            self._on_schedule_command,
            10,
        )
        self.schedule_active_subscription = self.create_subscription(
            Bool,
            self.get_parameter('schedule_active_topic').value,
            self._on_schedule_active,
            QoSProfile(
                depth=1,
                reliability=QoSReliabilityPolicy.RELIABLE,
                durability=QoSDurabilityPolicy.TRANSIENT_LOCAL,
            ),
        )
        self.release_timer = self.create_timer(
            min(max(self.button_hold_sec / 4.0, 0.01), 0.05),
            self._release_button_if_due,
        )

        self._active_button = None
        self._release_at = math.inf
        self._last_non_stop_command_time = -math.inf

        self.get_logger().info(
            f'control_gateway_node up: {self.input_topic} -> {self.output_topic} '
            f'(commands: 1=enable motors, 2=play motion, 3=stop motion, '
            f'4=home, 5=disable motors, 6=move to start)'
        )

    def _on_schedule_active(self, msg: Bool) -> None:
        self.schedule_active = bool(msg.data)

    def _on_command(self, msg: UInt8) -> None:
        if self.schedule_active:
            self.get_logger().warn(
                f'rejected control command while schedule is ON: {int(msg.data)}'
            )
            return
        self._handle_command(int(msg.data))

    def _on_schedule_command(self, msg: UInt8) -> None:
        self._handle_command(int(msg.data))

    def _handle_command(self, command: int) -> None:
        button = COMMAND_BUTTONS.get(command)
        if button is None:
            self.get_logger().warn(f'rejected unknown control command: {command}')
            return

        now = time.monotonic()
        if (
            command not in (COMMAND_STOP_MOTION, COMMAND_DISABLE_MOTORS)
            and now - self._last_non_stop_command_time
            < self.min_command_interval_sec
        ):
            self.get_logger().warn(
                f'rejected rate-limited control command: {COMMAND_NAMES[command]}'
            )
            return

        # Complete any prior press before starting a new one so RobotManagerNode
        # always observes a clean rising edge, even for rapid STOP commands.
        if self._active_button is not None:
            self._publish_release()

        self._publish_button(button, pressed=True)
        self._active_button = button
        self._release_at = now + self.button_hold_sec
        if command not in (COMMAND_STOP_MOTION, COMMAND_DISABLE_MOTORS):
            self._last_non_stop_command_time = now

        self.get_logger().info(
            f'accepted control command: {COMMAND_NAMES[command]}'
        )

    def _release_button_if_due(self) -> None:
        if (
            self._active_button is not None
            and time.monotonic() >= self._release_at
        ):
            self._publish_release()

    def _publish_release(self) -> None:
        self._publish_button(self._active_button, pressed=False)
        self._active_button = None
        self._release_at = math.inf

    def _publish_button(self, button: int | None, pressed: bool) -> None:
        msg = Joy()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.axes = []
        msg.buttons = [0] * JOY_BUTTON_COUNT
        if pressed and button is not None:
            msg.buttons[button] = 1
        self.joy_publisher.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = ControlGatewayNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()
