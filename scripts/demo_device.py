#!/usr/bin/env python3
"""
Praxis Lattice — Demo Device Agent
====================================
Simulates a physical device registered in the Lattice network.

Usage:
    python demo_device.py --url https://web-production-646a4.up.railway.app/api \
                          --token YOUR_SUPABASE_JWT \
                          --slug demo-node \
                          --name "Demo Node" \
                          --type custom

The script will:
  1. Register the device (upsert — safe to re-run)
  2. Print the dk_* API key
  3. Start the agent loop:
     - heartbeat every 30s (status: online)
     - poll for pending jobs every 10s
     - execute jobs (prints to terminal, sleeps to simulate work)
     - report progress and final status back to Praxis

Ctrl-C to stop.
"""

import argparse
import json
import sys
import time
import random
import signal
import threading
import requests
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────

POLL_INTERVAL   = 10   # seconds between job polls
HEARTBEAT_SECS  = 30   # seconds between heartbeats

# ── CLI ───────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Praxis Lattice demo device agent")
parser.add_argument("--url",   default="https://web-production-646a4.up.railway.app/api",
                    help="Praxis API base URL")
parser.add_argument("--token", required=True,
                    help="Supabase access_token (JWT) for device registration")
parser.add_argument("--slug",  default="demo-node", help="Device slug (unique per user)")
parser.add_argument("--name",  default="Demo Node",  help="Device display name")
parser.add_argument("--type",  default="custom",
                    choices=["3dprinter","cnc_mill","computer","smart_home","wearable","camera","server","custom"],
                    help="Device type")
parser.add_argument("--dry-run", action="store_true",
                    help="Print what would happen without making API calls")
args = parser.parse_args()

BASE     = args.url.rstrip("/")
JWT      = args.token
SLUG     = args.slug
NAME     = args.name
DEV_TYPE = args.type
DRY      = args.dry_run

# ── State ─────────────────────────────────────────────────────────────────────

device_key: str | None = None
running = True

# ── Helpers ───────────────────────────────────────────────────────────────────

def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")

def log(msg: str, color: str = "") -> None:
    colors = {"green": "\033[92m", "yellow": "\033[93m", "red": "\033[91m",
              "cyan": "\033[96m", "dim": "\033[2m", "": ""}
    reset = "\033[0m" if color else ""
    print(f"{colors[color]}[{ts()}] {msg}{reset}", flush=True)

def jwt_headers() -> dict:
    return {"Authorization": f"Bearer {JWT}", "Content-Type": "application/json"}

def dk_headers() -> dict:
    return {"x-device-key": device_key, "Content-Type": "application/json"}

def api(method: str, path: str, headers: dict, body: dict | None = None) -> dict | None:
    if DRY:
        log(f"[DRY] {method.upper()} {path} {json.dumps(body or {})}", "dim")
        return {"ok": True, "dry_run": True}
    try:
        resp = getattr(requests, method)(f"{BASE}{path}", json=body, headers=headers, timeout=10)
        if resp.ok:
            return resp.json()
        log(f"HTTP {resp.status_code} {path}: {resp.text[:200]}", "red")
        return None
    except requests.exceptions.RequestException as e:
        log(f"Network error {path}: {e}", "red")
        return None

# ── Device registration ───────────────────────────────────────────────────────

def register() -> bool:
    global device_key
    log(f"Registering device: {NAME} ({SLUG}, {DEV_TYPE})", "cyan")
    data = api("post", "/lattice/devices/register", jwt_headers(), {
        "name": NAME, "slug": SLUG, "type": DEV_TYPE,
        "capabilities": ["demo", "simulation"],
        "metadata": {"agent": "demo_device.py", "version": "1.0"},
    })
    if not data:
        log("Registration failed — check JWT token", "red")
        return False
    if DRY:
        device_key = "dk_dryrun_fakekey_0000000000000000"
    else:
        device_key = data.get("api_key") or data.get("dk_key")
    if not device_key:
        log("No api_key in registration response", "red")
        return False
    log(f"Registered. Device key: {device_key[:12]}...", "green")
    log(f"Device ID: {data.get('id', 'N/A')}", "dim")
    return True

# ── Heartbeat thread ──────────────────────────────────────────────────────────

def heartbeat_loop():
    while running:
        for _ in range(HEARTBEAT_SECS):
            if not running:
                return
            time.sleep(1)
        result = api("post", "/lattice/devices/heartbeat", dk_headers(), {"status": "online"})
        if result:
            log("♡  heartbeat sent", "dim")
        else:
            log("Heartbeat failed", "yellow")

# ── Job executor ──────────────────────────────────────────────────────────────

SIMULATED_JOBS: dict[str, tuple[int, str]] = {
    # job_type → (duration_seconds, description)
    "print_file":        (8,  "Printing... heating bed → extruding → cooling"),
    "run_script":        (5,  "Executing script... "),
    "calibrate":         (6,  "Calibrating axes... X → Y → Z"),
    "capture_photo":     (2,  "Capturing frame..."),
    "toggle_light":      (1,  "Toggling smart home light"),
    "compile":           (7,  "Compiling source..."),
    "scan":              (5,  "Scanning environment..."),
    "backup":            (10, "Backing up data..."),
}

def execute_job(job: dict) -> tuple[str, str | None]:
    """
    Simulate executing a job.
    Returns (final_status, error_msg).
    """
    job_id  = job["id"]
    jtype   = job["type"]
    payload = job.get("payload", {})

    duration, desc = SIMULATED_JOBS.get(jtype, (3, f"Running {jtype}..."))

    log(f"  ▶ JOB {job_id[:8]}  type={jtype}  payload={json.dumps(payload)}", "cyan")
    log(f"  {desc}", "dim")

    # Mark running
    api("patch", f"/lattice/jobs/{job_id}/status", dk_headers(), {
        "status": "running", "progress_pct": 0
    })

    # Simulate progress
    steps = 5
    for step in range(1, steps + 1):
        if not running:
            return "failed", "agent stopped"
        time.sleep(duration / steps)
        pct = int((step / steps) * 100)
        api("patch", f"/lattice/jobs/{job_id}/status", dk_headers(), {
            "status": "running", "progress_pct": pct
        })
        log(f"  {'█' * step}{'░' * (steps - step)} {pct}%", "dim")

    # 5% random failure for realism
    if not DRY and random.random() < 0.05:
        log(f"  ✗ JOB {job_id[:8]} FAILED (simulated fault)", "red")
        return "failed", "simulated hardware fault"

    result = {"output": f"{jtype} completed", "duration_s": duration}
    api("patch", f"/lattice/jobs/{job_id}/status", dk_headers(), {
        "status": "done", "progress_pct": 100, "result": result
    })
    log(f"  ✓ JOB {job_id[:8]} DONE", "green")
    return "done", None

# ── Poll loop ─────────────────────────────────────────────────────────────────

def poll_loop():
    while running:
        data = api("post", "/lattice/jobs/poll", dk_headers())
        if data:
            jobs = data.get("jobs", [])
            if jobs:
                log(f"Received {len(jobs)} job(s)", "yellow")
                for job in jobs:
                    execute_job(job)
            else:
                log("No pending jobs", "dim")
        for _ in range(POLL_INTERVAL):
            if not running:
                return
            time.sleep(1)

# ── Shutdown ──────────────────────────────────────────────────────────────────

def shutdown(sig, frame):
    global running
    running = False
    log("Shutting down — marking device offline...", "yellow")
    if device_key:
        api("post", "/lattice/devices/heartbeat", dk_headers(), {"status": "offline"})
    log("Goodbye.", "dim")
    sys.exit(0)

signal.signal(signal.SIGINT,  shutdown)
signal.signal(signal.SIGTERM, shutdown)

# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "═" * 60)
    print("  PRAXIS LATTICE — DEMO DEVICE AGENT")
    print("═" * 60 + "\n")

    if not register():
        sys.exit(1)

    log("Starting heartbeat thread...", "dim")
    hb = threading.Thread(target=heartbeat_loop, daemon=True)
    hb.start()

    log(f"Polling for jobs every {POLL_INTERVAL}s. Ctrl-C to stop.\n", "green")
    poll_loop()
