from __future__ import annotations

import os
import time
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from app.utils.safe_path import is_excluded_system_path


@dataclass
class FileRecord:
    path: str
    size: int
    mtime: float
    atime: float


@dataclass
class WalkResult:
    path: str
    records: list[FileRecord] = field(default_factory=list)
    folder_sizes: dict[str, int] = field(default_factory=dict)
    dirs_by_parent: dict[str, list[str]] = field(default_factory=dict)
    files_by_parent: dict[str, list[tuple[str, int]]] = field(default_factory=dict)
    entries_visited: int = 0
    permission_denied: int = 0
    partial: bool = False
    stop_reason: str = ""
    elapsed_ms: int = 0
    generated_at: int = 0


def _norm_path(path: Path | str) -> str:
    return Path(path).as_posix()


def _cut_top(items: dict[str, int], limit: int) -> list[dict]:
    top = sorted(items.items(), key=lambda row: row[1], reverse=True)[:limit]
    return [{"path": path, "size": int(size)} for path, size in top]


def _add_to_ancestors(
    folder_sizes: dict[str, int], root: Path, file_parent: Path, file_size: int
) -> None:
    current = file_parent
    root_key = _norm_path(root)
    while True:
        key = _norm_path(current)
        folder_sizes[key] = folder_sizes.get(key, 0) + file_size
        if key == root_key:
            break
        parent = current.parent
        if parent == current:
            break
        current = parent


def _register_dir_child(dirs_by_parent: dict[str, list[str]], parent: Path, child: Path) -> None:
    parent_key = _norm_path(parent)
    child_key = _norm_path(child)
    children = dirs_by_parent.setdefault(parent_key, [])
    if child_key not in children:
        children.append(child_key)


def walk_records(
    root_path: Path,
    max_depth: int,
    max_entries: int,
    timeout_sec: float,
    follow_symlinks: bool = False,
    exclude_system_paths: bool = True,
) -> WalkResult:
    start = time.perf_counter()
    root_key = _norm_path(root_path)
    stack: list[tuple[Path, int]] = [(root_path, 0)]
    folder_sizes: dict[str, int] = {root_key: 0}
    dirs_by_parent: dict[str, list[str]] = defaultdict(list)
    files_by_parent: dict[str, list[tuple[str, int]]] = defaultdict(list)
    records: list[FileRecord] = []
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
                            file_path = Path(entry.path)
                            path_str = _norm_path(file_path)
                            parent_key = _norm_path(file_path.parent)
                            records.append(
                                FileRecord(
                                    path=path_str,
                                    size=size,
                                    mtime=float(stat.st_mtime),
                                    atime=float(stat.st_atime),
                                )
                            )
                            files_by_parent[parent_key].append((path_str, size))
                            _add_to_ancestors(
                                folder_sizes=folder_sizes,
                                root=root_path,
                                file_parent=file_path.parent,
                                file_size=size,
                            )
                            continue

                        if entry.is_dir(follow_symlinks=follow_symlinks) and depth < max_depth:
                            path = Path(entry.path)
                            if exclude_system_paths and is_excluded_system_path(path):
                                continue
                            child_key = _norm_path(path)
                            folder_sizes.setdefault(child_key, 0)
                            _register_dir_child(dirs_by_parent, current_dir, path)
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
    return WalkResult(
        path=root_key,
        records=records,
        folder_sizes=folder_sizes,
        dirs_by_parent=dict(dirs_by_parent),
        files_by_parent=dict(files_by_parent),
        entries_visited=entries_visited,
        permission_denied=permission_denied,
        partial=partial,
        stop_reason=stop_reason,
        elapsed_ms=elapsed_ms,
        generated_at=int(time.time()),
    )


def scan_directory(
    root_path: Path,
    max_depth: int,
    max_entries: int,
    top_n: int,
    timeout_sec: float,
    follow_symlinks: bool = False,
    exclude_system_paths: bool = True,
) -> dict:
    walk = walk_records(
        root_path=root_path,
        max_depth=max_depth,
        max_entries=max_entries,
        timeout_sec=timeout_sec,
        follow_symlinks=follow_symlinks,
        exclude_system_paths=exclude_system_paths,
    )

    files: dict[str, int] = {record.path: record.size for record in walk.records}
    top_folders = _cut_top(walk.folder_sizes, top_n)
    top_files = _cut_top(files, top_n)

    return {
        "path": walk.path,
        "top_folders": top_folders,
        "top_files": top_files,
        "entries_visited": walk.entries_visited,
        "permission_denied": walk.permission_denied,
        "partial": walk.partial,
        "stop_reason": walk.stop_reason,
        "elapsed_ms": walk.elapsed_ms,
        "generated_at": walk.generated_at,
    }
