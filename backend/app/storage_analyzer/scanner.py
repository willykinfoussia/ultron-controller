from __future__ import annotations

import os
import time
from pathlib import Path

from app.utils.safe_path import is_excluded_system_path


def _cut_top(items: dict[str, int], limit: int) -> list[dict]:
    top = sorted(items.items(), key=lambda row: row[1], reverse=True)[:limit]
    return [{"path": path, "size": int(size)} for path, size in top]


def _add_to_ancestors(
    folder_sizes: dict[str, int], root: Path, file_parent: Path, file_size: int, depth: int
) -> None:
    current = file_parent
    for _ in range(depth + 1):
        folder_sizes[str(current)] = folder_sizes.get(str(current), 0) + file_size
        if current == root:
            break
        parent = current.parent
        if parent == current:
            break
        current = parent


def scan_directory(
    root_path: Path,
    max_depth: int,
    max_entries: int,
    top_n: int,
    timeout_sec: float,
    follow_symlinks: bool = False,
    exclude_system_paths: bool = True,
) -> dict:
    start = time.perf_counter()
    stack: list[tuple[Path, int]] = [(root_path, 0)]
    folder_sizes: dict[str, int] = {str(root_path): 0}
    files: dict[str, int] = {}
    entries_visited = 0
    permission_denied = 0
    partial = False
    stop_reason = ""

    while stack:
        if time.perf_counter() - start > timeout_sec:
            partial = True
            stop_reason = "timeout"
            break

        current_dir, depth = stack.pop()
        try:
            with os.scandir(current_dir) as iterator:
                for entry in iterator:
                    entries_visited += 1

                    if entries_visited > max_entries:
                        partial = True
                        stop_reason = "max_entries_reached"
                        break

                    if time.perf_counter() - start > timeout_sec:
                        partial = True
                        stop_reason = "timeout"
                        break

                    try:
                        if entry.is_symlink() and not follow_symlinks:
                            continue

                        if entry.is_file(follow_symlinks=follow_symlinks):
                            stat = entry.stat(follow_symlinks=follow_symlinks)
                            size = int(stat.st_size)
                            path_str = str(Path(entry.path))
                            files[path_str] = size
                            _add_to_ancestors(
                                folder_sizes=folder_sizes,
                                root=root_path,
                                file_parent=Path(entry.path).parent,
                                file_size=size,
                                depth=depth,
                            )
                            continue

                        if entry.is_dir(follow_symlinks=follow_symlinks) and depth < max_depth:
                            path = Path(entry.path)
                            if exclude_system_paths and is_excluded_system_path(path):
                                continue
                            stack.append((path, depth + 1))
                    except (PermissionError, FileNotFoundError, OSError):
                        permission_denied += 1
                        continue
        except (PermissionError, FileNotFoundError, OSError):
            permission_denied += 1
            continue

        if partial:
            break

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    top_folders = _cut_top(folder_sizes, top_n)
    top_files = _cut_top(files, top_n)

    return {
        "path": str(root_path),
        "top_folders": top_folders,
        "top_files": top_files,
        "entries_visited": entries_visited,
        "permission_denied": permission_denied,
        "partial": partial,
        "stop_reason": stop_reason,
        "elapsed_ms": elapsed_ms,
        "generated_at": int(time.time()),
    }
