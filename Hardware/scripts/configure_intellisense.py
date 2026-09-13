"""Refresh ESP32 IntelliSense for Hardware opened alone or within AquaSense.

Run with PlatformIO's Python: python Hardware/scripts/configure_intellisense.py
Generated editor files and compilation databases stay ignored by Git.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


HARDWARE = Path(__file__).resolve().parents[1]
ROOT = HARDWARE.parent
ENVIRONMENTS = ("water-monitor", "feeder", "water-quality", "water-quality-legacy")
CONFIG_NAME = "AquaSense ESP32 (PlatformIO)"


def read_generated_json(path):
    # PlatformIO prepends // comments to otherwise standard JSON.
    return json.loads("\n".join(
        line for line in path.read_text(encoding="utf-8-sig").splitlines()
        if not line.lstrip().startswith("//")
    ))


def main():
    root_config = ROOT / ".vscode" / "c_cpp_properties.json"
    if root_config.exists():
        existing = read_generated_json(root_config)
        if any(item.get("name") != CONFIG_NAME for item in existing.get("configurations", [])):
            raise RuntimeError("Existing root C++ configuration is not managed by this script; merge it manually before rerunning.")

    environment = os.environ.copy()
    local_core = HARDWARE / ".pio-core"
    if local_core.is_dir():
        environment.setdefault("PLATFORMIO_CORE_DIR", str(local_core))

    def pio(*arguments):
        subprocess.run([sys.executable, "-m", "platformio", *arguments],
                       cwd=ROOT, env=environment, check=True)

    # Each environment has different source filters/dependencies. Preserve each
    # database before the next compiledb target replaces the default output.
    databases = []
    for target in ENVIRONMENTS:
        pio("run", "--project-dir", str(HARDWARE), "--environment", target, "--target", "compiledb")
        destination = HARDWARE / ".pio" / "ide" / target / "compile_commands.json"
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(HARDWARE / "compile_commands.json", destination)
        databases.append(destination.as_posix())

    # PlatformIO supplies exact ESP32 compiler, SDK includes, defines and standard
    # for standalone headers/reference files without a compilation-database entry.
    pio("project", "init", "--project-dir", str(HARDWARE), "--ide", "vscode",
        "--environment", "water-monitor")
    hardware_config = HARDWARE / ".vscode" / "c_cpp_properties.json"
    data = read_generated_json(hardware_config)
    for configuration in data["configurations"]:
        configuration["name"] = CONFIG_NAME
        configuration["compileCommands"] = databases
    # Absolute machine-generated paths work in either workspace-folder layout.
    text = json.dumps(data, indent=2) + "\n"
    root_config.parent.mkdir(parents=True, exist_ok=True)
    root_config.write_text(text, encoding="utf-8")
    hardware_config.write_text(text, encoding="utf-8")
    print("ESP32 IntelliSense configured for AquaSense and Hardware workspace roots.")
    print("If stale squiggles remain, run 'C/C++: Reset IntelliSense Database' in VS Code.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"IntelliSense setup failed: {error}", file=sys.stderr)
        sys.exit(1)
