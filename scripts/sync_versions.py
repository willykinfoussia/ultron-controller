from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACK_VERSION_FILE = ROOT / "backend" / "VERSION"
FRONT_VERSION_FILE = ROOT / "frontend" / "VERSION"


def read_version(path: Path) -> str:
    value = path.read_text(encoding="utf-8").strip()
    if not value:
        raise ValueError(f"Version file is empty: {path}")
    if not re.match(r"^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$", value):
        raise ValueError(f"Invalid semver in {path}: {value}")
    return value


def sync_backend(version: str) -> None:
    pyproject = ROOT / "backend" / "pyproject.toml"
    lines = pyproject.read_text(encoding="utf-8").splitlines()
    in_project = False
    changed = False
    found = False
    new_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            in_project = stripped == "[project]"
        if in_project and re.match(r'^\s*version\s*=\s*".*"\s*$', line):
            found = True
            target = f'version = "{version}"'
            if line.strip() != target:
                line = target
                changed = True
        new_lines.append(line)

    if not found:
        raise RuntimeError("Could not locate [project].version in backend/pyproject.toml")

    if changed:
        pyproject.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


def sync_frontend(version: str) -> None:
    package_json = ROOT / "frontend" / "package.json"
    package_data = json.loads(package_json.read_text(encoding="utf-8"))
    package_data["version"] = version
    package_json.write_text(json.dumps(package_data, indent=2) + "\n", encoding="utf-8")

    lock_json = ROOT / "frontend" / "package-lock.json"
    lock_data = json.loads(lock_json.read_text(encoding="utf-8"))
    lock_data["version"] = version
    if isinstance(lock_data.get("packages"), dict) and isinstance(lock_data["packages"].get(""), dict):
        lock_data["packages"][""]["version"] = version
    lock_json.write_text(json.dumps(lock_data, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    back_version = read_version(BACK_VERSION_FILE)
    front_version = read_version(FRONT_VERSION_FILE)
    sync_backend(back_version)
    sync_frontend(front_version)
    print(f"Synced backend version: {back_version}")
    print(f"Synced frontend version: {front_version}")


if __name__ == "__main__":
    main()
