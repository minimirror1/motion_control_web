from glob import glob
from setuptools import find_packages, setup

package_name = 'motion_control_web'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/launch', glob('launch/*.py')),
        ('share/' + package_name + '/config', glob('config/*.yaml')),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='shs',
    maintainer_email='minimirror1@gmail.com',
    description='Headless-robot remote control web UI: rosbridge/web_video_server launch, and a safety gateway node between web-origin commands and motion_control/motor_command.',
    license='MIT',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'safety_gateway_node = motion_control_web.safety_gateway_node:main',
            'mock_state_publisher_node = motion_control_web.mock_state_publisher_node:main',
        ],
    },
)
