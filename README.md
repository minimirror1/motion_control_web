# motion_control_web

## English Version

`motion_control_web` is a remote control web UI for a headless ROS 2 robot
(Raspberry Pi 5, ROS 2 Jazzy). It serves on-robot and lets a browser monitor
robot/motor state, send motion commands, and (later) view live camera/sensor
streams.

### Core Goals (read this before changing the architecture)

These decisions were made deliberately - re-derive from here, don't
re-litigate from scratch:

1. **Bridge = `rosbridge_suite` + `web_video_server`, not a custom FastAPI
   backend.** rosbridge is a generic JSON<->ROS-msg passthrough: it needs no
   per-message codegen, so `motion_control_msgs/RobotState` and `MotorStatus`
   work through it as-is, and stay working if those message definitions change.
   A FastAPI backend would need `rclpy` running inside the same process as
   FastAPI's asyncio event loop - that integration is a well-known source of
   deadlock/dropped-callback bugs that only show up at runtime under load, not
   in code review. Since this code is largely LLM-authored, we deliberately
   keep that risky integration out of scope by using an existing, already
   battle-tested binary (rosbridge_suite) instead of writing it ourselves.
2. **Safety gateway node is the *only* custom logic between the browser and
   the motors.** rosbridge has no schema/bounds validation - a raw browser
   payload must never be wired directly to `motion_control/motor_command`.
   `safety_gateway_node` (rate limit + bounds check) is the single, thin,
   testable place that stands in the way. See `config/gateway_params.yaml` -
   **the bounds in there are placeholders and are NOT tuned to real hardware
   limits.** Tune them before any field use.
3. **Frontend = React + TypeScript + Vite + roslib.js + Zustand + Tailwind.**
   Chosen for ecosystem breadth and because it's what an LLM reliably produces
   consistent, modern UI with. `web/` is a separate npm project, deliberately
   *not* wired into the `colcon build` (avoids fragile ament+npm integration).
4. **Dev loop happens off the robot.** Run `npm run dev` on a laptop pointed
   at the robot's `rosbridge_websocket` over LAN (`VITE_ROSBRIDGE_URL`) -
   no redeploy-to-Pi cycle needed for frontend iteration. `mock_dev.launch.py`
   (rosbridge + `mock_state_publisher_node`) lets you develop the frontend
   with zero access to the real robot.
5. **Deployment = on-robot.** nginx on the Pi serves the built SPA and
   reverse-proxies to rosbridge/web_video_server on one origin (see
   `deploy/nginx.motion_control_web.conf.example`) - avoids mixed-content/CORS,
   and gives one place to add TLS/auth. rosbridge itself has **no
   authentication** - don't expose its port beyond the LAN without adding
   that at the nginx/firewall layer.
6. **Testing = practical level, not exhaustive.** Vitest+RTL for frontend
   units, pytest for the gateway node, Playwright for a browser smoke test,
   plus a manual checklist before any field deploy: websocket-disconnect
   behavior (must show "disconnected", must NOT allow sending commands while
   stale), E-stop latency, multi-client CPU load on the Pi. No CI/HIL rig -
   that was explicitly descoped.

### Topics

| Name | Type | Direction |
| --- | --- | --- |
| `motion_control/robot_state` | `motion_control_msgs/msg/RobotState` | robot -> web (monitor) |
| `motion_control/motor_status` | `motion_control_msgs/msg/MotorStatus` | robot -> web (monitor) |
| `motion_control/motor_command` | `motion_control_msgs/msg/MotorStatus` | **real command sink** - never publish here directly from the browser |
| `motion_control_web/motor_command_request` | `motion_control_msgs/msg/MotorStatus` | web -> `safety_gateway_node` (validated, then forwarded to `motion_control/motor_command`) |
| `motion_control_web/control_command` | `std_msgs/msg/UInt8` | web -> `control_gateway_node`; `1` enable motors, `2` play motion, `3` stop motion, `4` home, `5` disable motors |
| `joy` | `sensor_msgs/msg/Joy` | `control_gateway_node` -> existing `RobotManagerNode` joystick interface |

### Build & Run (ROS 2 side)

```bash
# first time only
sudo apt install ros-jazzy-rosbridge-suite ros-jazzy-web-video-server

cd ~/colcon_ws
colcon build --packages-select motion_control_web
source install/setup.bash

# real robot stack (rosbridge + web_video_server + safety_gateway_node)
ros2 launch motion_control_web motion_control_web.launch.py

# OR: offline dev stack (rosbridge + fake RobotState/MotorStatus publisher)
ros2 launch motion_control_web mock_dev.launch.py
```

### Frontend

```bash
cd web
npm install
cp .env.example .env.local   # point VITE_ROSBRIDGE_URL at the robot if not localhost
npm run dev                  # dev loop, run against mock_dev.launch.py or the real robot
npm run build                # production build -> web/dist, served by nginx on-robot
```

### Testing

```bash
colcon test --packages-select motion_control_web   # gateway node pytest

cd web
npm run test                                        # Vitest unit tests
npm run e2e                                          # Playwright smoke test (auto-starts vite dev)
```

---

## Korean Version

`motion_control_web`은 헤드리스 ROS 2 로봇(Raspberry Pi 5, ROS 2 Jazzy)을 위한
원격 제어 웹 UI입니다. 로봇 온보드에서 직접 서빙되며, 브라우저에서 로봇/모터
상태 모니터링, 모션 명령 전송, (추후) 실시간 카메라/센서 스트림 확인을
제공합니다.

### 핵심 목표 (아키텍처를 바꾸기 전에 먼저 읽을 것)

아래 결정들은 의도적으로 내려진 것입니다 - 처음부터 다시 논의하지 말고 여기서
근거를 확인하세요:

1. **브리지는 커스텀 FastAPI 백엔드가 아니라 `rosbridge_suite` +
   `web_video_server`.** rosbridge는 범용 JSON<->ROS msg 패스스루라 메시지별
   코드 생성이 필요 없고, `motion_control_msgs/RobotState`/`MotorStatus`가
   그대로 통과하며 메시지 정의가 바뀌어도 계속 동작합니다. FastAPI 백엔드는
   `rclpy`를 FastAPI의 asyncio 이벤트루프와 같은 프로세스에서 돌려야 하는데,
   이 통합은 코드리뷰로는 못 잡고 부하 상황의 런타임에서만 터지는
   데드락/콜백드롭 버그의 흔한 원인입니다. 이 코드 대부분이 LLM이 작성한다는
   점을 고려해, 우리가 직접 짜는 대신 이미 검증된 기존 바이너리
   (rosbridge_suite)를 써서 그 위험한 통합 구간 자체를 스코프 밖에 둡니다.
2. **브라우저와 모터 사이의 유일한 커스텀 로직은 안전 게이트웨이 노드.**
   rosbridge는 스키마/범위 검증이 없으므로, 브라우저의 원시 payload가
   `motion_control/motor_command`에 직접 연결되면 안 됩니다.
   `safety_gateway_node`(rate limit + bounds check)가 그 사이를 막는 유일하고
   얇고 테스트 가능한 지점입니다. `config/gateway_params.yaml`을 보세요 -
   **여기 들어간 bounds 값은 placeholder이며 실제 하드웨어 한계에 맞춰
   튜닝되지 않았습니다.** 실제 필드 사용 전에 반드시 튜닝하세요.
3. **프론트엔드는 React + TypeScript + Vite + roslib.js + Zustand +
   Tailwind.** 생태계가 넓고 LLM이 일관되고 완성도 높은 UI를 안정적으로
   뽑아내는 조합이라 선택했습니다. `web/`은 별도 npm 프로젝트이며, 의도적으로
   `colcon build`에는 엮지 않았습니다 (ament+npm 통합의 취약함을 피하기 위함).
4. **개발 루프는 로봇 위가 아니라 로봇 밖에서.** 노트북에서 `npm run dev`를
   로봇의 `rosbridge_websocket`(LAN, `VITE_ROSBRIDGE_URL`)로 붙여서 사용 -
   프론트엔드 반복 작업마다 Pi에 재배포할 필요 없음. `mock_dev.launch.py`
   (rosbridge + `mock_state_publisher_node`)로 실제 로봇 없이도 프론트엔드
   개발 가능.
5. **배포는 로봇 온보드.** Pi의 nginx가 빌드된 SPA를 서빙하고
   rosbridge/web_video_server로 리버스 프록시 (`deploy/nginx.motion_control_web.conf.example`
   참고) - mixed-content/CORS 회피, TLS/인증을 붙일 지점을 한 곳으로 모음.
   rosbridge 자체는 **인증이 없으므로** nginx/방화벽 계층에서 막지 않고 LAN
   밖으로 포트를 노출하지 마세요.
6. **테스트는 실용적 수준, 전수 검증 아님.** 프론트엔드 단위 테스트는
   Vitest+RTL, 게이트웨이 노드는 pytest, 브라우저 스모크는 Playwright, 그리고
   실제 필드 배포 전 수동 체크리스트: 웹소켓 연결 끊김 시 동작("disconnected"
   표시, 끊긴 상태에서 명령 전송 금지), E-stop 지연시간, 다중 클라이언트 접속
   시 Pi CPU 부하. CI/HIL 리그는 이번 스코프에서 명시적으로 제외.

### 토픽

| 이름 | 타입 | 방향 |
| --- | --- | --- |
| `motion_control/robot_state` | `motion_control_msgs/msg/RobotState` | 로봇 -> 웹 (모니터링) |
| `motion_control/motor_status` | `motion_control_msgs/msg/MotorStatus` | 로봇 -> 웹 (모니터링) |
| `motion_control/motor_command` | `motion_control_msgs/msg/MotorStatus` | **실제 명령 수신처** - 브라우저에서 직접 publish 금지 |
| `motion_control_web/motor_command_request` | `motion_control_msgs/msg/MotorStatus` | 웹 -> `safety_gateway_node` (검증 후 `motion_control/motor_command`로 전달) |
| `motion_control_web/control_command` | `std_msgs/msg/UInt8` | 웹 -> `control_gateway_node`; `1` 모터 활성화, `2` 모션 재생, `3` 모션 중지, `4` Home, `5` 모터 비활성화 |
| `joy` | `sensor_msgs/msg/Joy` | `control_gateway_node` -> 기존 `RobotManagerNode` 조이스틱 인터페이스 |

### 빌드 & 실행 (ROS 2 쪽)

```bash
# 최초 1회
sudo apt install ros-jazzy-rosbridge-suite ros-jazzy-web-video-server

cd ~/colcon_ws
colcon build --packages-select motion_control_web
source install/setup.bash

# 실제 로봇 스택 (rosbridge + web_video_server + safety_gateway_node)
ros2 launch motion_control_web motion_control_web.launch.py

# 또는: 오프라인 개발용 스택 (rosbridge + 가짜 RobotState/MotorStatus 퍼블리셔)
ros2 launch motion_control_web mock_dev.launch.py
```

### 프론트엔드

```bash
cd web
npm install
cp .env.example .env.local   # localhost가 아니면 VITE_ROSBRIDGE_URL을 로봇 주소로
npm run dev                  # 개발 루프, mock_dev.launch.py 또는 실제 로봇 대상으로 실행
npm run build                # 프로덕션 빌드 -> web/dist, 로봇 온보드 nginx가 서빙
```

### 테스트

```bash
colcon test --packages-select motion_control_web   # 게이트웨이 노드 pytest

cd web
npm run test                                        # Vitest 단위 테스트
npm run e2e                                          # Playwright 스모크 테스트 (vite dev 자동 실행)
```
