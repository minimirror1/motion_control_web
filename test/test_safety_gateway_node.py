import rclpy
from motion_control_msgs.msg import MotorStatus

from motion_control_web.safety_gateway_node import SafetyGatewayNode


def _make_status(position):
    msg = MotorStatus()
    msg.position = position
    msg.velocity = [0.0] * len(position)
    msg.effort = [0.0] * len(position)
    return msg


def test_within_bounds_true_for_small_values():
    rclpy.init()
    node = SafetyGatewayNode()
    try:
        assert node._within_bounds(_make_status([1.0, -1.0])) is True
    finally:
        node.destroy_node()
        rclpy.shutdown()


def test_within_bounds_false_when_position_exceeds_limit():
    rclpy.init()
    node = SafetyGatewayNode()
    try:
        node.max_abs_position = 5.0
        assert node._within_bounds(_make_status([10.0])) is False
    finally:
        node.destroy_node()
        rclpy.shutdown()


def test_rate_limited_command_is_dropped():
    rclpy.init()
    node = SafetyGatewayNode()
    try:
        node.min_command_interval_sec = 10.0
        received = []
        node.command_publisher.publish = lambda msg: received.append(msg)

        node._on_command_request(_make_status([0.0]))
        node._on_command_request(_make_status([0.0]))

        assert len(received) == 1
    finally:
        node.destroy_node()
        rclpy.shutdown()
