from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    rosbridge_port_arg = DeclareLaunchArgument(
        'rosbridge_port',
        default_value='9090',
        description='rosbridge_websocket listen port.',
    )

    return LaunchDescription([
        rosbridge_port_arg,
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
    ])
