import os
import re
import tempfile

import rclpy
import yaml
from rclpy.node import Node

from motion_control_msgs.srv import (
    GetMotorConfig,
    GetMotorConfigYaml,
    ListMotorTemplates,
    SetMotorConfigYaml,
)

MOTION_SYSTEM_FILES_DIR = os.environ.get(
    'MOTION_SYSTEM_FILES_DIR',
    os.path.expanduser('~/colcon_ws/files'),
)
DEFAULT_CONFIG_FILE = os.path.join(
    MOTION_SYSTEM_FILES_DIR, 'motor_manager', 'active_motor_manager.yaml',
)

TEMPLATE_NAME_RE = re.compile(r'^example_[a-z0-9_]+\.yaml$')


class MotorConfigGatewayNode(Node):
    """Serves static per-motor config (angle limits, gear ratio, rated
    effort, motor type) to web clients over a service, joining
    masters[].slaves[] against drivers[] by driver_id - the same join
    motion_control_rqt's motor_manager_widget.MotorManagerWidget._load_motor_infos()
    already does for the desktop rqt tool. Re-reads the YAML on every call.
    """

    def __init__(self):
        super().__init__('motor_config_gateway_node')

        self.declare_parameter('config_file', DEFAULT_CONFIG_FILE)
        self.declare_parameter('service_name', 'motion_control_web/get_motor_config')
        self.declare_parameter(
            'list_templates_service_name', 'motion_control_web/list_motor_templates',
        )
        self.declare_parameter(
            'get_motor_config_yaml_service_name', 'motion_control_web/get_motor_config_yaml',
        )
        self.declare_parameter(
            'set_motor_config_yaml_service_name', 'motion_control_web/set_motor_config_yaml',
        )

        self.config_file = str(self.get_parameter('config_file').value)
        service_name = str(self.get_parameter('service_name').value)
        list_templates_service_name = str(
            self.get_parameter('list_templates_service_name').value
        )
        get_motor_config_yaml_service_name = str(
            self.get_parameter('get_motor_config_yaml_service_name').value
        )
        set_motor_config_yaml_service_name = str(
            self.get_parameter('set_motor_config_yaml_service_name').value
        )

        self.service = self.create_service(
            GetMotorConfig, service_name, self._on_get_motor_config,
        )
        self.list_templates_service = self.create_service(
            ListMotorTemplates, list_templates_service_name, self._on_list_motor_templates,
        )
        self.get_motor_config_yaml_service = self.create_service(
            GetMotorConfigYaml, get_motor_config_yaml_service_name,
            self._on_get_motor_config_yaml,
        )
        self.set_motor_config_yaml_service = self.create_service(
            SetMotorConfigYaml, set_motor_config_yaml_service_name,
            self._on_set_motor_config_yaml,
        )

        self.get_logger().info(
            f'motor_config_gateway_node up: serving {service_name} from {self.config_file}'
        )

    def _on_get_motor_config(self, request, response):
        try:
            with open(self.config_file, 'r', encoding='utf-8') as yaml_file:
                config = yaml.safe_load(yaml_file) or {}
        except Exception as exc:
            self.get_logger().error(f'Failed to load motor config: {exc}')
            response.success = False
            response.message = f'Failed to load motor config: {exc}'
            return response

        drivers = {
            driver['id']: driver
            for driver in config.get('drivers', [])
            if isinstance(driver, dict) and 'id' in driver
        }

        controller_index, lower, upper, speed = [], [], [], []
        gear_ratio, rated_effort, motor_type = [], [], []
        for master in config.get('masters', []):
            if not isinstance(master, dict):
                continue
            for slave in master.get('slaves', []):
                if not isinstance(slave, dict) or slave.get('controller_index') is None:
                    continue
                driver = drivers.get(slave.get('driver_id'), {})
                controller_index.append(int(slave['controller_index']))
                lower.append(float(driver.get('lower', 0.0)))
                upper.append(float(driver.get('upper', 0.0)))
                speed.append(float(driver.get('speed', 0.0)))
                gear_ratio.append(float(driver.get('gear_ratio', 1.0)))
                rated_effort.append(float(driver.get('rated_effort', 0.0)))
                motor_type.append(str(driver.get('type', '')))

        response.success = True
        response.message = 'ok'
        response.controller_index = controller_index
        response.lower = lower
        response.upper = upper
        response.speed = speed
        response.gear_ratio = gear_ratio
        response.rated_effort = rated_effort
        response.motor_type = motor_type
        return response

    def _templates_dir(self):
        return os.path.dirname(self.config_file)

    def _list_template_names(self):
        directory = self._templates_dir()
        try:
            names = os.listdir(directory)
        except OSError:
            return []
        return sorted(
            name for name in names
            if TEMPLATE_NAME_RE.match(name) and os.path.isfile(os.path.join(directory, name))
        )

    def _resolve_template_path(self, name):
        """Returns an absolute path only for a name that is regex-whitelisted,
        resolves inside _templates_dir() (defense-in-depth against traversal
        and symlinks), and is present in the current template listing.
        Returns None on any failure.
        """
        if not TEMPLATE_NAME_RE.match(name):
            return None
        templates_dir = self._templates_dir()
        candidate = os.path.join(templates_dir, name)
        real_dir = os.path.realpath(templates_dir)
        real_candidate = os.path.realpath(candidate)
        if os.path.dirname(real_candidate) != real_dir:
            return None
        if name not in self._list_template_names():
            return None
        return real_candidate

    def _on_list_motor_templates(self, request, response):
        try:
            response.templates = self._list_template_names()
            response.success = True
            response.message = 'ok'
        except Exception as exc:
            self.get_logger().error(f'Failed to list motor templates: {exc}')
            response.success = False
            response.message = f'Failed to list motor templates: {exc}'
        return response

    def _on_get_motor_config_yaml(self, request, response):
        source = request.source
        if source in ('', 'active'):
            path = self.config_file
            source_path = os.path.basename(self.config_file)
        else:
            path = self._resolve_template_path(source)
            source_path = source
            if path is None:
                response.success = False
                response.message = f'Unknown or invalid template name: {source!r}'
                return response

        try:
            with open(path, 'r', encoding='utf-8') as yaml_file:
                response.yaml_text = yaml_file.read()
            response.source_path = source_path
            response.success = True
            response.message = 'ok'
        except Exception as exc:
            self.get_logger().error(f'Failed to read {source_path}: {exc}')
            response.success = False
            response.message = f'Failed to read {source_path}: {exc}'
        return response

    def _on_set_motor_config_yaml(self, request, response):
        try:
            parsed = yaml.safe_load(request.yaml_text)
        except yaml.YAMLError as exc:
            response.success = False
            response.message = f'Invalid YAML: {exc}'
            return response

        if not isinstance(parsed, dict):
            response.success = False
            response.message = 'YAML document must be a mapping at the top level.'
            return response
        if not isinstance(parsed.get('masters'), list):
            response.success = False
            response.message = "Missing or invalid top-level 'masters' list."
            return response
        if not isinstance(parsed.get('drivers'), list):
            response.success = False
            response.message = "Missing or invalid top-level 'drivers' list."
            return response

        driver_ids = {
            driver.get('id') for driver in parsed['drivers'] if isinstance(driver, dict)
        }
        for master in parsed['masters']:
            if not isinstance(master, dict):
                continue
            for slave in master.get('slaves') or []:
                if isinstance(slave, dict) and slave.get('driver_id') not in driver_ids:
                    response.success = False
                    response.message = (
                        f"slave driver_id {slave.get('driver_id')!r} has no matching "
                        f"drivers[].id"
                    )
                    return response

        try:
            directory = os.path.dirname(self.config_file)
            fd, tmp_path = tempfile.mkstemp(
                dir=directory, prefix='.active_motor_manager.', suffix='.yaml.tmp',
            )
            try:
                with os.fdopen(fd, 'w', encoding='utf-8') as tmp_file:
                    tmp_file.write(request.yaml_text)
                os.replace(tmp_path, self.config_file)
            except Exception:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                raise
        except Exception as exc:
            self.get_logger().error(f'Failed to write {self.config_file}: {exc}')
            response.success = False
            response.message = f'Failed to write {self.config_file}: {exc}'
            return response

        response.success = True
        response.message = 'ok'
        return response


def main(args=None):
    rclpy.init(args=args)
    node = MotorConfigGatewayNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
