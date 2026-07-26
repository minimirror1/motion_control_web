import rclpy
from motion_control_msgs.srv import GetMotorConfig

from motion_control_web.motor_config_gateway_node import MotorConfigGatewayNode


def _write_config(tmp_path):
    config_file = tmp_path / 'active_motor_manager.yaml'
    config_file.write_text(
        'masters:\n'
        '  - id: 0\n'
        '    slaves:\n'
        '      - controller_index: 0\n'
        '        driver_id: 0\n'
        '      - controller_index: 1\n'
        '        driver_id: 1\n'
        'drivers:\n'
        '  - id: 0\n'
        '    type: dynamixel\n'
        '    gear_ratio: 2.0\n'
        '    rated_effort: 1.5\n'
        '    lower: -10.0\n'
        '    upper: 10.0\n'
        '    speed: 5.0\n'
        '  - id: 1\n'
        '    type: minas\n'
        '    gear_ratio: 1.0\n'
        '    rated_effort: 100.0\n'
        '    lower: -180.0\n'
        '    upper: 180.0\n'
        '    speed: 2000.0\n'
    )
    return str(config_file)


def test_joins_slaves_to_drivers_by_driver_id(tmp_path):
    rclpy.init()
    node = MotorConfigGatewayNode()
    try:
        node.config_file = _write_config(tmp_path)
        response = node._on_get_motor_config(
            GetMotorConfig.Request(), GetMotorConfig.Response(),
        )

        assert response.success is True
        assert list(response.controller_index) == [0, 1]
        assert list(response.motor_type) == ['dynamixel', 'minas']
        assert list(response.gear_ratio) == [2.0, 1.0]
        assert list(response.lower) == [-10.0, -180.0]
        assert list(response.upper) == [10.0, 180.0]
    finally:
        node.destroy_node()
        rclpy.shutdown()


def test_reports_failure_for_missing_file():
    rclpy.init()
    node = MotorConfigGatewayNode()
    try:
        node.config_file = '/nonexistent/path/active_motor_manager.yaml'
        response = node._on_get_motor_config(
            GetMotorConfig.Request(), GetMotorConfig.Response(),
        )

        assert response.success is False
        assert response.message
    finally:
        node.destroy_node()
        rclpy.shutdown()


def test_reports_failure_for_malformed_yaml(tmp_path):
    rclpy.init()
    node = MotorConfigGatewayNode()
    try:
        config_file = tmp_path / 'broken.yaml'
        config_file.write_text('masters: [this is not valid: yaml::')
        node.config_file = str(config_file)
        response = node._on_get_motor_config(
            GetMotorConfig.Request(), GetMotorConfig.Response(),
        )

        assert response.success is False
    finally:
        node.destroy_node()
        rclpy.shutdown()
