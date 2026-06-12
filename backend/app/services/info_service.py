from __future__ import annotations

import os
from pathlib import Path
from typing import List, Dict, Any

from app.core.config import get_settings


class InfoService:
    def __init__(self) -> None:
        self.settings = get_settings()
        # Path to Hermes config and data
        self.hermes_path = Path.home() / ".hermes"
        self.config_path = self.hermes_path / "config.yaml"
        self.skills_path = self.hermes_path / "skills"

    def get_available_toolsets(self) -> List[str]:
        """Return list of enabled toolsets from Hermes config."""
        if not self.config_path.exists():
            return []
        try:
            import yaml
            config = yaml.safe_load(self.config_path.read_text())
            toolsets = config.get("toolsets", [])
            return [str(ts) for ts in toolsets] if isinstance(toolsets, list) else []
        except Exception:
            return []

    def get_all_toolsets_with_status(self) -> List[Dict[str, Any]]:
        """Return all known toolsets with their enabled/disabled status."""
        enabled = set(self.get_available_toolsets())
        # Common Hermes toolsets - this list should be kept in sync with Hermes source
        all_toolsets = [
            "browser", "coding", "computer_use", "cronjob", "delegation",
            "discord", "discord_admin", "feishu_doc", "feishu_drive", "file",
            "homeassistant", "image_gen", "kanban", "memory", "messaging",
            "search", "session_search", "skills", "spotify", "terminal",
            "tts", "video", "vision", "web", "x_search", "yuanbao",
            "hermes-cli", "kanban", "safe", "rl", "moa"
        ]
        return [
            {
                "name": ts,
                "enabled": ts in enabled,
                "description": self._get_toolset_description(ts)
            }
            for ts in all_toolsets
        ]

    def get_user_skills(self) -> List[Dict[str, str]]:
        """Return list of user-installed skills from ~/.hermes/skills/."""
        skills = []
        if not self.skills_path.exists():
            return skills
        for skill_dir in self.skills_path.iterdir():
            if skill_dir.is_dir():
                skill_file = skill_dir / "SKILL.md"
                if skill_file.exists():
                    try:
                        content = skill_file.read_text(errors="ignore")
                        # Extract name from directory or try to read from frontmatter
                        name = skill_dir.name
                        # Try to get title from frontmatter
                        if content.startswith("---"):
                            parts = content.split("---", 2)
                            if len(parts) >= 3:
                                frontmatter = parts[1]
                                for line in frontmatter.split("\n"):
                                    if line.strip().startswith("name:"):
                                        name = line.split(":", 1)[1].strip().strip('"')
                                        break
                        skills.append({
                            "name": name,
                            "path": str(skill_dir.relative_to(self.skills_path)),
                            "description": self._extract_skill_description(content)
                        })
                    except Exception:
                        # Fallback to directory name
                        skills.append({
                            "name": skill_dir.name,
                            "path": str(skill_dir.relative_to(self.skills_path)),
                            "description": "Skill directory"
                        })
        return sorted(skills, key=lambda x: x["name"])

    def get_builtin_skills(self) -> List[Dict[str, str]]:
        """Return list of built-in skills.
        This is a simplified version - in reality, these would be discovered
        from the Hermes skill registry or manifest.
        """
        # For now, return empty list - this would need to be enhanced
        # to read from Hermes internal skill registry
        return []

    def _get_toolset_description(self, toolset: str) -> str:
        """Return description for a toolset."""
        descriptions = {
            "browser": "Web browser automation and interaction",
            "coding": "Code editing and development tools",
            "computer_use": "Desktop control and GUI automation",
            "cronjob": "Scheduled job management",
            "delegation": "Sub-agent spawning and task delegation",
            "discord": "Discord platform integration",
            "discord_admin": "Discord admin tools",
            "feishu_doc": "Feishu document collaboration",
            "feishu_drive": "Feishu drive/file management",
            "file": "File system read/write operations",
            "homeassistant": "Home Assistant smart home integration",
            "image_gen": "Image generation (AI art, etc.)",
            "kanban": "Kanban board management",
            "memory": "Persistent memory storage and retrieval",
            "messaging": "Messaging platforms (Telegram, etc.)",
            "search": "Web search capabilities",
            "session_search": "Session history search and replay",
            "skills": "Skill management (create, update, delete skills)",
            "spotify": "Spotify music platform integration",
            "terminal": "Shell command execution",
            "tts": "Text-to-speech conversion",
            "video": "Video processing and analysis",
            "vision": "Image analysis and computer vision",
            "web": "General web access and HTTP requests",
            "x_search": "X/Twitter search and interaction",
            "yuanbao": "Yuanbao group messaging",
            "hermes-cli": "Hermes CLI command execution",
            "kanban": "Kanban board management (duplicate for compatibility)",
            "safe": "Minimal safe toolset for restricted operations",
            "rl": "Reinforcement learning tools",
            "moa": "Mixture of Agents framework"
        }
        return descriptions.get(toolset, "Toolset for Hermes functionality")

    def _extract_skill_description(self, content: str) -> str:
        """Extract description from skill SKILL.md content."""
        try:
            # Skip frontmatter
            if content.startswith("---"):
                parts = content.split("---", 2)
                if len(parts) >= 3:
                    content = parts[2]
            # Get first non-empty line that looks like a description
            for line in content.split("\n"):
                line = line.strip()
                if line and not line.startswith("#") and len(line) > 10:
                    # Take first sentence or up to 200 chars
                    desc = line.split(".")[0]
                    if len(desc) > 200:
                        desc = desc[:200] + "..."
                    return desc
            return "No description available"
        except Exception:
            return "Error extracting description"