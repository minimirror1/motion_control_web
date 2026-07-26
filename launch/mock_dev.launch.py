import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

DEFAULT_MOCK_MOTOR_CONFIG_FILE = os.path.join(
    get_package_share_directory('motion_control_web'),
    'config',
    'mock_motor_config.yaml',
)


def generate_launch_description():
    rosbridge_port_arg = DeclareLaunchArgument(
        'rosbridge_port',
        default_value='9090',
        description='rosbridge_websocket listen port.',
    )
    motor_config_file_arg = DeclareLaunchArgument(
        'motor_config_file',
        default_value=DEFAULT_MOCK_MOTOR_CONFIG_FILE,
        description='Absolute path to a fixture motor config YAML for dev.',
    )

    return LaunchDescription([
        rosbridge_port_arg,
        motor_config_file_arg,
        Node(
            package='rosbridge_server',
            executable='rosbridge_websocket',
            name='rosbridge_websocket',
            output='screen',
            parameters=[{
                'port': LaunchConfiguration('rosbridge_port'),
            }],
        ),
        Node(
            package='motion_control_web',
            executable='mock_state_publisher_node',
            name='mock_state_publisher_node',
            output='screen',
        ),
        Node(
            package='motion_control_web',
            executable='motor_config_gateway_node',
            name='motor_config_gateway_node',
            output='screen',
            parameters=[{
                'config_file': LaunchConfiguration('motor_config_file'),
            }],
        ),
    ])
