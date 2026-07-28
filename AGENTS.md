# AGENTS.md

## Cursor Cloud specific instructions

This repo has two independent dev surfaces. Standard commands live in `README.md`
(Build & Run / Frontend / Testing) — the notes below only capture non-obvious,
Cloud-specific context.

### Layout / what's preinstalled (persisted in the VM snapshot)

- **Frontend (`web/`)** — self-contained React + TS + Vite app. This is the only
  application fully contained in this repo. `node_modules` is refreshed by the
  update script (`npm ci` in `web/`). Playwright's Chromium is already installed
  under `~/.cache/ms-playwright` (do not re-download unless missing).
- **ROS 2 side** — ROS 2 Jazzy (`ros-base` + `rosbridge-suite`) is installed at
  `/opt/ros/jazzy`. A colcon workspace lives at `~/colcon_ws`:
  - `~/colcon_ws/src/motion_control_web` is a **symlink to `/workspace`**, so the
    ROS package always tracks the repo.
  - `~/colcon_ws/src/motion_control_msgs` is the **external** message package
    (`msg/`+`srv/`), copied from `minimirror1/motion_system_ros2`
    (`ros2/motion_system_ros2/motion_control_msgs`). It is NOT part of this repo
    but every ROS node imports it.
  - Built with `colcon build --symlink-install`. Recreate if missing:
    `mkdir -p ~/colcon_ws/src`, put the two packages under `src/` as above, then
    `source /opt/ros/jazzy/setup.bash && cd ~/colcon_ws && colcon build --symlink-install`.

### Running

- Always `source /opt/ros/jazzy/setup.bash && source ~/colcon_ws/install/setup.bash`
  in any shell before `ros2 ...`.
- **Mock dev stack (works here, no real robot):**
  `ros2 launch motion_control_web mock_dev.launch.py` starts rosbridge on
  `:9090` + a fake state publisher + the motor-config service node.
- **Frontend dev:** `cd web && npm run dev` (Vite on `:5173`). It reads
  `VITE_ROSBRIDGE_URL` from `web/.env.local` (default `ws://localhost:9090`,
  copied from `.env.example`). Run it against the mock stack for a full
  browser -> rosbridge -> ROS round trip (dashboard shows live motor data; the
  Motor Settings tab issues a real ROS service call).

### Gotchas

- The **real-robot** launch `motion_control_web.launch.py` CANNOT run here: it
  depends on the external `motion_control_teach` package (and real hardware),
  which is not installed. Use `mock_dev.launch.py` for local work.
- The mock publisher **intentionally** reports a fault on motor 2
  (`errorcode=[0,0,5]`, one disabled motor). The UI showing an error/comm-fail
  badge for motor 2 is expected mock behavior, not a bug.
- `--symlink-install` means edits to ROS node Python source are picked up on
  node restart without a rebuild. Rebuild (`colcon build --symlink-install`) only
  after changing `setup.py` entry points, adding new files/launch/config, or
  after `motion_control_msgs` changes.
- rosbridge has no auth; only bind it to localhost/LAN.
