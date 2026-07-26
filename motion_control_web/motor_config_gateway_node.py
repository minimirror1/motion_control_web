import os

import rclpy
import yaml
from rclpy.node import Node

from motion_control_msgs.srv import GetMotorConfig

MOTION_SYSTEM_FILES_DIR = os.environ.get(
    'MOTION_SYSTEM_FILES_DIR',
    os.path.expanduser('~/colcon_ws/files'),
)
DEFAULT_CONFIG_FILE = os.path.join(
    MOTION_SYSTEM_FILES_DIR, 'motor_manager', 'active_motor_manager.yaml',
)


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

        self.config_file = str(self.get_parameter('config_file').value)
        service_name = str(self.get_parameter('service_name').value)

        self.service = self.create_service(
            GetMotorConfig, service_name, self._on_get_motor_config,
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
