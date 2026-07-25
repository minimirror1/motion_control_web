import time

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSDurabilityPolicy, QoSHistoryPolicy, QoSProfile, QoSReliabilityPolicy

from motion_control_msgs.msg import MotorStatus

# Matches the QoS motion_control_robot's robot_manager_node uses for
# motion_control/motor_command, so this node's publisher is actually
# received by it.
QOS_BEKL1V = QoSProfile(
    reliability=QoSReliabilityPolicy.BEST_EFFORT,
    history=QoSHistoryPolicy.KEEP_LAST,
    depth=1,
    durability=QoSDurabilityPolicy.VOLATILE,
)


class SafetyGatewayNode(Node):
    """Validates web-origin motor commands before forwarding them to the real robot.

    rosbridge is a generic, unvalidated JSON<->msg passthrough, so a raw
    browser payload must never be wired directly to motion_control/motor_command.
    This node sits in between: it applies a rate limit and (placeholder) bounds
    checks, and only republishes commands that pass.
    """

    def __init__(self):
        super().__init__('safety_gateway_node')

        self.declare_parameter('input_topic', 'motion_control_web/motor_command_request')
        self.declare_parameter('output_topic', 'motion_control/motor_command')
        self.declare_parameter('min_command_interval_sec', 0.05)
        self.declare_parameter('bounds_enabled', True)
        self.declare_parameter('max_abs_position', 1.0e6)
        self.declare_parameter('max_abs_velocity', 1.0e6)
        self.declare_parameter('max_abs_effort', 1.0e6)

        self.input_topic = self.get_parameter('input_topic').value
        self.output_topic = self.get_parameter('output_topic').value
        self.min_command_interval_sec = self.get_parameter('min_command_interval_sec').value
        self.bounds_enabled = self.get_parameter('bounds_enabled').value
        self.max_abs_position = self.get_parameter('max_abs_position').value
        self.max_abs_velocity = self.get_parameter('max_abs_velocity').value
        self.max_abs_effort = self.get_parameter('max_abs_effort').value

        if self.bounds_enabled and self.max_abs_position >= 1.0e6:
            self.get_logger().warn(
                'bounds_enabled is true but max_abs_* are still at placeholder '
                'defaults (1.0e6) - tune these to real hardware limits before '
                'field use.'
            )

        self._last_accepted_time = 0.0

        self.command_publisher = self.create_publisher(
            MotorStatus,
            self.output_topic,
            QOS_BEKL1V,
        )
        self.command_subscriber = self.create_subscription(
            MotorStatus,
            self.input_topic,
            self._on_command_request,
            10,
        )

        self.get_logger().info(
            f'safety_gateway_node up: {self.input_topic} -> {self.output_topic} '
            f'(rate limit {self.min_command_interval_sec}s, bounds_enabled={self.bounds_enabled})'
        )

    def _on_command_request(self, msg: MotorStatus) -> None:
        now = time.monotonic()
        if now - self._last_accepted_time < self.min_command_interval_sec:
            self.get_logger().debug('rejected command: rate limit')
            return

        if self.bounds_enabled and not self._within_bounds(msg):
            self.get_logger().warn('rejected command: out of bounds')
            return

        self._last_accepted_time = now
        self.command_publisher.publish(msg)

    def _within_bounds(self, msg: MotorStatus) -> bool:
        return (
            all(abs(v) <= self.max_abs_position for v in msg.position)
            and all(abs(v) <= self.max_abs_velocity for v in msg.velocity)
            and all(abs(v) <= self.max_abs_effort for v in msg.effort)
        )


def main(args=None):
    rclpy.init(args=args)
    node = SafetyGatewayNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
