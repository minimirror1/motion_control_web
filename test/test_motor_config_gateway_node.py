import yaml

import rclpy
from motion_control_msgs.srv import (
    GetMotorConfig,
    GetMotorConfigYaml,
    ListMotorTemplates,
    SetMotorConfigYaml,
)

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


def _setup_node(tmp_path):
    node = MotorConfigGatewayNode()
    node.config_file = _write_config(tmp_path)
    (tmp_path / 'example_a.yaml').write_text('masters: []\ndrivers: []\n')
    (tmp_path / 'example_b.yaml').write_text('masters: []\ndrivers: []\n')
    (tmp_path / 'notes.txt').write_text('not a template')
    return node


def test_lists_only_example_prefixed_yaml_files(tmp_path):
    rclpy.init()
    try:
        node = _setup_node(tmp_path)
        try:
            response = node._on_list_motor_templates(
                ListMotorTemplates.Request(), ListMotorTemplates.Response(),
            )
            assert response.success is True
            assert list(response.templates) == ['example_a.yaml', 'example_b.yaml']
        finally:
            node.destroy_node()
    finally:
        rclpy.shutdown()


def test_get_motor_config_yaml_returns_active_contents(tmp_path):
    rclpy.init()
    try:
        node = _setup_node(tmp_path)
        try:
            expected = open(node.config_file, 'r', encoding='utf-8').read()
            for source in ('active', ''):
                response = node._on_get_motor_config_yaml(
                    GetMotorConfigYaml.Request(source=source), GetMotorConfigYaml.Response(),
                )
                assert response.success is True
                assert response.yaml_text == expected
                assert response.source_path == 'active_motor_manager.yaml'
        finally:
            node.destroy_node()
    finally:
        rclpy.shutdown()


def test_get_motor_config_yaml_returns_template_contents(tmp_path):
    rclpy.init()
    try:
        node = _setup_node(tmp_path)
        try:
            response = node._on_get_motor_config_yaml(
                GetMotorConfigYaml.Request(source='example_a.yaml'),
                GetMotorConfigYaml.Response(),
            )
            assert response.success is True
            assert response.yaml_text == 'masters: []\ndrivers: []\n'
            assert response.source_path == 'example_a.yaml'
        finally:
            node.destroy_node()
    finally:
        rclpy.shutdown()


def test_get_motor_config_yaml_rejects_path_traversal(tmp_path):
    rclpy.init()
    try:
        node = _setup_node(tmp_path)
        try:
            for source in (
                '../active_motor_manager.yaml',
                '/etc/passwd',
                'example_a.yaml/../../etc/passwd',
                '..%2Fexample_a.yaml',
            ):
                response = node._on_get_motor_config_yaml(
                    GetMotorConfigYaml.Request(source=source), GetMotorConfigYaml.Response(),
                )
                assert response.success is False
        finally:
            node.destroy_node()
    finally:
        rclpy.shutdown()


def test_get_motor_config_yaml_rejects_unknown_template(tmp_path):
    rclpy.init()
    try:
        node = _setup_node(tmp_path)
        try:
            response = node._on_get_motor_config_yaml(
                GetMotorConfigYaml.Request(source='example_does_not_exist.yaml'),
                GetMotorConfigYaml.Response(),
            )
            assert response.success is False
        finally:
            node.destroy_node()
    finally:
        rclpy.shutdown()


def test_set_motor_config_yaml_writes_and_is_readable_back(tmp_path):
    rclpy.init()
    try:
        node = _setup_node(tmp_path)
        try:
            new_yaml = (
                'masters:\n'
                '  - id: 0\n'
                '    slaves:\n'
                '      - controller_index: 0\n'
                '        driver_id: 5\n'
                'drivers:\n'
                '  - id: 5\n'
                '    type: dynamixel\n'
            )
            response = node._on_set_motor_config_yaml(
                SetMotorConfigYaml.Request(yaml_text=new_yaml), SetMotorConfigYaml.Response(),
            )
            assert response.success is True

            with open(node.config_file, 'r', encoding='utf-8') as config_file:
                written = yaml.safe_load(config_file)
            assert written == yaml.safe_load(new_yaml)
        finally:
            node.destroy_node()
    finally:
        rclpy.shutdown()


def test_set_motor_config_yaml_rejects_invalid_yaml_syntax(tmp_path):
    rclpy.init()
    try:
        node = _setup_node(tmp_path)
        try:
            original = open(node.config_file, 'r', encoding='utf-8').read()
            response = node._on_set_motor_config_yaml(
                SetMotorConfigYaml.Request(yaml_text='masters: [this is not valid: yaml::'),
                SetMotorConfigYaml.Response(),
            )
            assert response.success is False
            assert open(node.config_file, 'r', encoding='utf-8').read() == original
        finally:
            node.destroy_node()
    finally:
        rclpy.shutdown()


def test_set_motor_config_yaml_rejects_missing_masters_or_drivers(tmp_path):
    rclpy.init()
    try:
        node = _setup_node(tmp_path)
        try:
            for yaml_text in ('drivers: []\n', 'masters: []\n'):
                response = node._on_set_motor_config_yaml(
                    SetMotorConfigYaml.Request(yaml_text=yaml_text),
                    SetMotorConfigYaml.Response(),
                )
                assert response.success is False
        finally:
            node.destroy_node()
    finally:
        rclpy.shutdown()


def test_set_motor_config_yaml_rejects_dangling_driver_id(tmp_path):
    rclpy.init()
    try:
        node = _setup_node(tmp_path)
        try:
            yaml_text = (
                'masters:\n'
                '  - id: 0\n'
                '    slaves:\n'
                '      - controller_index: 0\n'
                '        driver_id: 99\n'
                'drivers:\n'
                '  - id: 0\n'
                '    type: dynamixel\n'
            )
            response = node._on_set_motor_config_yaml(
                SetMotorConfigYaml.Request(yaml_text=yaml_text), SetMotorConfigYaml.Response(),
            )
            assert response.success is False
        finally:
            node.destroy_node()
    finally:
        rclpy.shutdown()
