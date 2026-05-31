import urllib.request
import json

BASE = "http://127.0.0.1:8001/api/kanban"

endpoints = [
    ("GET", f"{BASE}/summary", None),
    ("GET", f"{BASE}/boards", None),
    ("GET", f"{BASE}/boards/default", None),
    ("GET", f"{BASE}/boards/default?status=done&limit=5", None),
    ("GET", f"{BASE}/agents", None),
    ("GET", f"{BASE}/activity", None),
    ("GET", f"{BASE}/activity?limit=5&type=created", None),
]

for method, url, _ in endpoints:
    try:
        req = urllib.request.Request(url, method=method)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode()
            parsed = json.loads(data)
            print(f"OK  {method} {url}")
            print(json.dumps(parsed, indent=2, default=str))
            print("---")
    except Exception as e:
        print(f"ERR {method} {url}: {e}")
        print("---")
