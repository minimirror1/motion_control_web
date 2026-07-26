import math

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSDurabilityPolicy, QoSHistoryPolicy, QoSProfile, QoSReliabilityPolicy
from std_msgs.msg import Int8MultiArray

from motion_control_msgs.msg import MotorStatus, RobotState

QOS_BEKL1V = QoSProfile(
    reliability=QoSReliabilityPolicy.BEST_EFFORT,
    history=QoSHistoryPolicy.KEEP_LAST,
    depth=1,
    durability=QoSDurabilityPolicy.VOLATILE,
)

NUM_MOCK_MOTORS = 3


class MockStatePublisherNode(Node):
    """Publishes fake RobotState/MotorStatus so the web frontend can be
    developed and smoke-tested without a real robot attached.
    """

    def __init__(self):
        super().__init__('mock_state_publisher_node')

        self.declare_parameter('publish_rate_hz', 10.0)
        publish_rate_hz = self.get_parameter('publish_rate_hz').value

        self.robot_state_publisher = self.create_publisher(
            RobotState,
            'motion_control/robot_state',
            QOS_BEKL1V,
        )
        self.motor_status_publisher = self.create_publisher(
            MotorStatus,
            'motion_control/motor_status',
            QOS_BEKL1V,
        )

        self._t = 0.0
        self._dt = 1.0 / publish_rate_hz
        self.timer = self.create_timer(self._dt, self._on_timer)

        self.get_logger().info(
            f'mock_state_publisher_node up: publishing fake state at {publish_rate_hz} Hz'
        )

    def _on_timer(self) -> None:
        self._t += self._dt

        robot_state = RobotState()
        robot_state.selected_robot_index = 0
        robot_state.robot_index = [0]
        robot_state.state = [RobotState.STATE_OPERATING]
        robot_state.progress = [min(1.0, self._t / 10.0)]
        self.robot_state_publisher.publish(robot_state)

        motor_status = MotorStatus()
        motor_status.number_of_target_interfaces = [1] * NUM_MOCK_MOTORS
        motor_status.target_interface_id = [Int8MultiArray(data=[0]) for _ in range(NUM_MOCK_MOTORS)]
        motor_status.controller_index = list(range(NUM_MOCK_MOTORS))
        motor_status.controlword = [0] * NUM_MOCK_MOTORS
        motor_status.statusword = [0x0027, 0, 1]  # motor 0,2 enabled pattern, motor 1 disabled
        motor_status.errorcode = [0, 0, 5]  # fake fault code on motor 2
        motor_status.encoder = [0] * NUM_MOCK_MOTORS
        motor_status.position = [
            math.sin(self._t + i) for i in range(NUM_MOCK_MOTORS)
        ]
        motor_status.velocity = [
            math.cos(self._t + i) for i in range(NUM_MOCK_MOTORS)
        ]
        motor_status.effort = [0.0] * NUM_MOCK_MOTORS
        self.motor_status_publisher.publish(motor_status)


def main(args=None):
    rclpy.init(args=args)
    node = MockStatePublisherNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
