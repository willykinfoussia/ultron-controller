#!/usr/bin/env python3
"""One-shot helper to generate a Telethon StringSession for Ultron Controller.

Usage:
  export ULTRON_TELEGRAM_API_ID=12345678
  export ULTRON_TELEGRAM_API_HASH=your_api_hash
  python scripts/telegram_session_setup.py

Or pass credentials interactively when env vars are unset.
Store the printed session string in ULTRON_TELEGRAM_SESSION_STRING (server secrets).
"""

from __future__ import annotations

import asyncio
import getpass
import os
import sys


def _backend_venv_python() -> str | None:
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if os.name == "nt":
        candidate = os.path.join(repo_root, "backend", ".venv", "Scripts", "python.exe")
    else:
        candidate = os.path.join(repo_root, "backend", ".venv", "bin", "python")
    return candidate if os.path.isfile(candidate) else None


def _ensure_backend_venv() -> None:
    venv_python = _backend_venv_python()
    if venv_python is None:
        return
    if os.path.realpath(sys.executable) == os.path.realpath(venv_python):
        return
    os.execv(venv_python, [venv_python, *sys.argv])


_ensure_backend_venv()


async def main() -> None:
    try:
        from telethon import TelegramClient
        from telethon.errors import SessionPasswordNeededError
        from telethon.sessions import StringSession
    except ImportError:
        print(
            "Telethon not found. Install deps then re-run:\n"
            "  cd backend && uv sync\n"
            "  cd .. && python scripts/telegram_session_setup.py",
            file=sys.stderr,
        )
        sys.exit(1)

    api_id_raw = os.environ.get("ULTRON_TELEGRAM_API_ID", "").strip()
    api_hash = os.environ.get("ULTRON_TELEGRAM_API_HASH", "").strip()

    if not api_id_raw:
        api_id_raw = input("Telegram API ID (my.telegram.org): ").strip()
    if not api_hash:
        api_hash = getpass.getpass("Telegram API hash: ").strip()

    try:
        api_id = int(api_id_raw)
    except ValueError:
        print("API ID must be an integer.", file=sys.stderr)
        sys.exit(1)

    phone = input("Phone number (international, e.g. +33612345678): ").strip()
    if not phone:
        print("Phone number is required.", file=sys.stderr)
        sys.exit(1)

    client = TelegramClient(StringSession(), api_id, api_hash)
    await client.connect()

    try:
        await client.send_code_request(phone)
        code = input("Code received on Telegram: ").strip()
        try:
            await client.sign_in(phone=phone, code=code)
        except SessionPasswordNeededError:
            password = getpass.getpass("Two-factor password: ")
            await client.sign_in(password=password)
    finally:
        session_string = client.session.save()
        me = await client.get_me()
        await client.disconnect()

    print("\n--- Session created ---")
    if me is not None:
        label = me.username or me.first_name or str(me.id)
        print(f"Account: {label} (id={me.id})")
    print("\nAdd to your server secrets:\n")
    print(f"ULTRON_TELEGRAM_API_ID={api_id}")
    print(f"ULTRON_TELEGRAM_API_HASH={api_hash}")
    print(f"ULTRON_TELEGRAM_SESSION_STRING={session_string}")
    bot = input("\nBot username for ULTRON_TELEGRAM_BOT_USERNAME (optional, no @): ").strip()
    if bot:
        print(f"ULTRON_TELEGRAM_BOT_USERNAME={bot.lstrip('@')}")


if __name__ == "__main__":
    asyncio.run(main())
