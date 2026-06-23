from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from app.storage_analyzer.scanner import WalkResult, _norm_path


def build_browse_index(walk: WalkResult) -> dict:
    root = _norm_path(walk.path)
    entries_by_parent: dict[str, list[dict]] = defaultdict(list)

    for parent, children in walk.dirs_by_parent.items():
        parent_key = _norm_path(parent)
        for child in children:
            child_key = _norm_path(child)
            child_path = Path(child_key)
            entries_by_parent[parent_key].append(
                {
                    "path": child_key,
                    "name": child_path.name or child_key,
                    "kind": "dir",
                    "size": int(walk.folder_sizes.get(child_key, 0)),
                }
            )

    for parent, files in walk.files_by_parent.items():
        parent_key = _norm_path(parent)
        for path_str, size in files:
            entries_by_parent[parent_key].append(
                {
                    "path": _norm_path(path_str),
                    "name": Path(path_str).name,
                    "kind": "file",
                    "size": int(size),
                }
            )

    normalized: dict[str, list[dict]] = {}
    for parent, entries in entries_by_parent.items():
        entries.sort(key=lambda row: row["size"], reverse=True)
        normalized[_norm_path(parent)] = entries

    return {
        "root": root,
        "entries_by_parent": normalized,
    }
