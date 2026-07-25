import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

DEFAULT_GATEWAY_PARAMS_FILE = os.path.join(
    get_package_share_directory('motion_control_web'),
    'config',
    'gateway_params.yaml',
)


def generate_launch_description():
    rosbridge_port_arg = DeclareLaunchArgument(
        'rosbridge_port',
        default_value='9090',
        description='rosbridge_websocket listen port.',
    )
    video_port_arg = DeclareLaunchArgument(
        'video_port',
        default_value='8080',
        description='web_video_server listen port.',
    )
    gateway_params_file_arg = DeclareLaunchArgument(
        'gateway_params_file',
        default_value=DEFAULT_GATEWAY_PARAMS_FILE,
        description='Absolute path to safety_gateway_node params YAML.',
    )

    return LaunchDescription([
        rosbridge_port_arg,
        video_port_arg,
        gateway_params_file_arg,
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
            package='web_video_server',
            executable='web_video_server',
            name='web_video_server',
            output='screen',
            parameters=[{
                'port': LaunchConfiguration('video_port'),
            }],
        ),
        Node(
            package='motion_control_web',
            executable='safety_gateway_node',
            name='safety_gateway_node',
            output='screen',
            parameters=[LaunchConfiguration('gateway_params_file')],
        ),
    ])
