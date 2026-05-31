from pathlib import Path
print("home:", Path.home())
print("db:", Path.home() / ".hermes" / "kanban.db")
print("exists:", (Path.home() / ".hermes" / "kanban.db").exists())
