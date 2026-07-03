#!/usr/bin/env python3
"""Check the deployed TypeMe Studio wiring without printing secrets."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LOCAL_CONFIG = Path("D:/Code/1123/mbti/config.json")
REMOTE = "https://typeme-beta.vercel.app"
TABLES = [
    "persona_response_samples",
    "persona_types",
    "prompt_versions",
    "persona_visual_presets",
    "analysis_logs",
]


def load_config() -> dict:
    if not LOCAL_CONFIG.exists():
        return {}
    return json.loads(LOCAL_CONFIG.read_text(encoding="utf-8-sig"))


def get(url: str, headers: dict[str, str] | None = None) -> tuple[int, str]:
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except Exception as exc:
        return 0, f"{type(exc).__name__}: {exc}"


def main() -> int:
    cfg = load_config()
    supabase_url = str(cfg.get("supabase_url") or "").rstrip("/")
    service_key = str(cfg.get("supabase_service_role_key") or "")

    print("remote:", REMOTE)
    for path in ["/studio", "/api/studio/auth/me", "/api/studio/health", "/api/studio/dashboard"]:
        status, body = get(REMOTE + path)
        print(f"{path}: {status} {body[:120].replace(chr(10), ' ')}")

    print("local_config:")
    for key in [
        "supabase_url",
        "supabase_anon_key",
        "supabase_service_role_key",
        "studio_admin_emails",
        "studio_cookie_secret",
        "deepseek_api_key",
    ]:
        print(f"  {key}: {bool(cfg.get(key))}")

    if not supabase_url or not service_key:
        print("supabase_rest: skipped, missing local config")
        return 1

    print("supabase_rest:")
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    missing = []
    for table in TABLES:
        status, body = get(f"{supabase_url}/rest/v1/{table}?select=id&limit=1", headers)
        print(f"  {table}: {status} {body[:110].replace(chr(10), ' ')}")
        if status == 404 and "PGRST205" in body:
            missing.append(table)

    if missing:
        print("missing_tables:", ", ".join(missing))
        print("next_step: run supabase/studio_samples_patch.sql or supabase/schema.sql in Supabase SQL editor")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
