import rclpy
from std_msgs.msg import UInt8

from motion_control_web.control_gateway_node import (
    COMMAND_DISABLE_MOTORS,
    COMMAND_ENABLE_MOTORS,
    COMMAND_HOME,
    COMMAND_PLAY_MOTION,
    COMMAND_STOP_MOTION,
    JOY_BUTTON_CROSS,
    JOY_BUTTON_CIRCLE,
    JOY_BUTTON_SQUARE,
    JOY_BUTTON_START,
    JOY_BUTTON_TRIANGLE,
    ControlGatewayNode,
)


def _make_command(value):
    return UInt8(data=value)


def _capture_messages(node):
    messages = []
    node.joy_publisher.publish = lambda msg: messages.append(msg)
    return messages


def test_commands_map_to_existing_joystick_buttons():
    rclpy.init()
    node = ControlGatewayNode()
    try:
        node.min_command_interval_sec = 0.0
        messages = _capture_messages(node)

        node._on_command(_make_command(COMMAND_ENABLE_MOTORS))
        node._publish_release()
        node._on_command(_make_command(COMMAND_PLAY_MOTION))
        node._publish_release()
        node._on_command(_make_command(COMMAND_STOP_MOTION))
        node._publish_release()
        node._on_command(_make_command(COMMAND_HOME))
        node._publish_release()
        node._on_command(_make_command(COMMAND_DISABLE_MOTORS))

        assert messages[0].buttons[JOY_BUTTON_START] == 1
        assert messages[2].buttons[JOY_BUTTON_CIRCLE] == 1
        assert messages[4].buttons[JOY_BUTTON_SQUARE] == 1
        assert messages[6].buttons[JOY_BUTTON_TRIANGLE] == 1
        assert messages[8].buttons[JOY_BUTTON_CROSS] == 1
    finally:
        node.destroy_node()
        rclpy.shutdown()


def test_unknown_command_is_rejected():
    rclpy.init()
    node = ControlGatewayNode()
    try:
        messages = _capture_messages(node)
        node._on_command(_make_command(255))
        assert messages == []
    finally:
        node.destroy_node()
        rclpy.shutdown()


def test_non_safety_command_is_rate_limited_but_stop_and_disable_are_not():
    rclpy.init()
    node = ControlGatewayNode()
    try:
        node.min_command_interval_sec = 10.0
        messages = _capture_messages(node)

        node._on_command(_make_command(COMMAND_ENABLE_MOTORS))
        node._on_command(_make_command(COMMAND_PLAY_MOTION))
        node._on_command(_make_command(COMMAND_STOP_MOTION))
        node._on_command(_make_command(COMMAND_DISABLE_MOTORS))

        pressed_buttons = [
            message.buttons.index(1)
            for message in messages
            if 1 in message.buttons
        ]
        assert pressed_buttons == [
            JOY_BUTTON_START,
            JOY_BUTTON_SQUARE,
            JOY_BUTTON_CROSS,
        ]
    finally:
        node.destroy_node()
        rclpy.shutdown()
