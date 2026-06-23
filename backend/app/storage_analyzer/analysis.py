from __future__ import annotations

import hashlib
import time
from collections import defaultdict
from dataclasses import dataclass

from app.storage_analyzer.classifier import categorize, junk_kind
from app.storage_analyzer.scanner import FileRecord, WalkResult

CHUNK_SIZE = 64 * 1024


@dataclass
class Deletability:
    score: int
    level: str
    reasons: list[str]

    def to_dict(self) -> dict:
        return {"score": self.score, "level": self.level, "reasons": self.reasons}


def _age_days(now: float, mtime: float) -> int:
    return max(0, int((now - mtime) / 86400))


def deletability_score(
    *,
    record: FileRecord,
    category: str,
    junk: str | None,
    is_duplicate: bool,
    now: float,
) -> Deletability:
    score = 0
    reasons: list[str] = []

    if junk:
        score += 40
        reasons.append(f"Junk/cache detected ({junk})")

    if is_duplicate:
        score += 30
        reasons.append("Potential duplicate file")

    age = _age_days(now, record.mtime)
    if age >= 365:
        score += 20
        reasons.append(f"Not modified for {age} days")
    elif age >= 180:
        score += 12
        reasons.append(f"Not modified for {age} days")
    elif age >= 90:
        score += 6
        reasons.append(f"Not modified for {age} days")

    if category in {"installer", "archive", "cache_log"}:
        score += 10
        reasons.append(f"Category '{category}' often safe to remove after use")

    score = min(100, score)
    if score >= 60:
        level = "high"
    elif score >= 30:
        level = "medium"
    else:
        level = "low"

    if not reasons:
        reasons.append("No strong cleanup signals")

    return Deletability(score=score, level=level, reasons=reasons)


def _partial_hash(path: str, size: int) -> str | None:
    hasher = hashlib.blake2b(digest_size=16)
    hasher.update(str(size).encode("ascii"))

    try:
        with open(path, "rb") as handle:
            head = handle.read(CHUNK_SIZE)
            hasher.update(head)
            if size > CHUNK_SIZE * 2:
                handle.seek(max(CHUNK_SIZE, size - CHUNK_SIZE))
                tail = handle.read(CHUNK_SIZE)
                hasher.update(tail)
    except (PermissionError, FileNotFoundError, OSError):
        return None

    return hasher.hexdigest()


def _find_duplicates(
    records: list[FileRecord],
    *,
    dup_min_size: int,
    dup_max_hashes: int,
    hash_budget_sec: float,
) -> tuple[list[dict], dict[str, bool], int]:
    by_size: dict[int, list[FileRecord]] = defaultdict(list)
    for record in records:
        if record.size >= dup_min_size:
            by_size[record.size].append(record)

    duplicate_paths: dict[str, bool] = {}
    groups: list[dict] = []
    hashes_done = 0
    start = time.perf_counter()

    candidates = sorted(
        ((size, items) for size, items in by_size.items() if len(items) > 1),
        key=lambda row: row[0] * len(row[1]),
        reverse=True,
    )

    for size, items in candidates:
        if hashes_done >= dup_max_hashes:
            break
        if time.perf_counter() - start > hash_budget_sec:
            break

        signature_map: dict[str, list[str]] = defaultdict(list)
        for record in items:
            if hashes_done >= dup_max_hashes:
                break
            if time.perf_counter() - start > hash_budget_sec:
                break

            signature = _partial_hash(record.path, record.size)
            hashes_done += 1
            if signature is None:
                continue
            signature_map[signature].append(record.path)

        for paths in signature_map.values():
            if len(paths) < 2:
                continue
            wasted = (len(paths) - 1) * size
            for path in paths:
                duplicate_paths[path] = True
            groups.append(
                {
                    "size": size,
                    "count": len(paths),
                    "wasted": wasted,
                    "paths": sorted(paths),
                }
            )

    groups.sort(key=lambda row: row["wasted"], reverse=True)
    return groups, duplicate_paths, hashes_done


def analyze_records(
    walk: WalkResult,
    *,
    limit: int,
    old_days: int,
    min_file_size: int,
    dup_min_size: int,
    dup_max_hashes: int,
    hash_budget_sec: float,
) -> dict:
    now = time.time()
    records = walk.records

    duplicate_groups, duplicate_paths, hashes_computed = _find_duplicates(
        records,
        dup_min_size=dup_min_size,
        dup_max_hashes=dup_max_hashes,
        hash_budget_sec=hash_budget_sec,
    )

    category_sizes: dict[str, int] = defaultdict(int)
    category_counts: dict[str, int] = defaultdict(int)
    junk_by_kind: dict[str, dict[str, int | list[str]]] = {}

    total_size = 0
    junk_size = 0
    duplicate_wasted = sum(group["wasted"] for group in duplicate_groups)

    file_insights: list[dict] = []

    for record in records:
        total_size += record.size
        category = categorize(record.path)
        junk = junk_kind(record.path)

        category_sizes[category] += record.size
        category_counts[category] += 1

        if junk:
            junk_size += record.size
            bucket = junk_by_kind.setdefault(junk, {"size": 0, "count": 0, "sample_paths": []})
            bucket["size"] = int(bucket["size"]) + record.size
            bucket["count"] = int(bucket["count"]) + 1
            samples: list[str] = bucket["sample_paths"]  # type: ignore[assignment]
            if len(samples) < 5:
                samples.append(record.path)

        deletability = deletability_score(
            record=record,
            category=category,
            junk=junk,
            is_duplicate=record.path in duplicate_paths,
            now=now,
        )

        file_insights.append(
            {
                "path": record.path,
                "size": record.size,
                "mtime": int(record.mtime),
                "atime": int(record.atime),
                "age_days": _age_days(now, record.mtime),
                "category": category,
                "junk_kind": junk,
                "deletability": deletability.to_dict(),
            }
        )

    file_insights.sort(key=lambda row: row["size"], reverse=True)
    largest_files = file_insights[:limit]

    categories = [
        {
            "category": category,
            "size": size,
            "count": category_counts[category],
        }
        for category, size in sorted(category_sizes.items(), key=lambda row: row[1], reverse=True)
    ]

    junk_entries = [
        {
            "kind": kind,
            "size": int(data["size"]),
            "count": int(data["count"]),
            "sample_paths": data["sample_paths"],
        }
        for kind, data in sorted(junk_by_kind.items(), key=lambda row: int(row[1]["size"]), reverse=True)
    ]

    old_files = [
        insight
        for insight in file_insights
        if insight["age_days"] >= old_days and insight["size"] >= min_file_size
    ][:limit]

    recoverable_estimate = junk_size + duplicate_wasted
    top_category = categories[0]["category"] if categories else "other"

    return {
        "path": walk.path,
        "summary": {
            "total_size": total_size,
            "file_count": len(records),
            "recoverable_estimate": recoverable_estimate,
            "junk_size": junk_size,
            "duplicate_wasted": duplicate_wasted,
            "top_category": top_category,
        },
        "categories": categories,
        "largest_files": largest_files,
        "junk": junk_entries,
        "old_files": old_files,
        "duplicates": duplicate_groups[:limit],
        "top_folders": _top_from_folders(walk.folder_sizes, limit),
        "top_files": [{"path": row["path"], "size": row["size"]} for row in file_insights[:limit]],
        "entries_visited": walk.entries_visited,
        "permission_denied": walk.permission_denied,
        "partial": walk.partial,
        "stop_reason": walk.stop_reason,
        "elapsed_ms": walk.elapsed_ms,
        "generated_at": walk.generated_at,
        "analysis_meta": {
            "old_days": old_days,
            "min_file_size": min_file_size,
            "hashes_computed": hashes_computed,
            "duplicate_groups_found": len(duplicate_groups),
        },
    }


def _top_from_folders(folder_sizes: dict[str, int], limit: int) -> list[dict]:
    top = sorted(folder_sizes.items(), key=lambda row: row[1], reverse=True)[:limit]
    return [{"path": path, "size": int(size)} for path, size in top]
