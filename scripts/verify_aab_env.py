#!/usr/bin/env python3
"""
Fail the release if the AAB's JS bundle does not carry the real backend config.

    python scripts/verify_aab_env.py <path-to.aab>

v1.0.11 (vc15) shipped to production with metro.config.js missing. Metro fell back
to bare React Native's defaults, which do not inject EXPO_PUBLIC_* variables, so
the client booted against the 'placeholder.supabase.co' fallback in
services/supabase.ts and every network call died with "Network request failed".
Nothing in the build failed — the bundle was simply wrong.

Run this on the .aab before every upload. It reads EXPO_PUBLIC_SUPABASE_URL from
.env and asserts that exact host is present in the packaged bundle.
"""

import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def expected_host() -> str:
    env = (ROOT / ".env").read_text(encoding="utf-8")
    m = re.search(r"^EXPO_PUBLIC_SUPABASE_URL\s*=\s*(\S+)", env, re.MULTILINE)
    if not m:
        raise SystemExit("FAIL: EXPO_PUBLIC_SUPABASE_URL not found in .env")
    return m.group(1).strip().removeprefix("https://").rstrip("/")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)

    aab = Path(sys.argv[1])
    if not aab.is_file():
        raise SystemExit(f"FAIL: no such file: {aab}")

    host = expected_host()

    with zipfile.ZipFile(aab) as z:
        names = [n for n in z.namelist() if n.endswith("index.android.bundle")]
        if not names:
            raise SystemExit("FAIL: no index.android.bundle inside the AAB")
        blob = b"".join(z.read(n) for n in names)

    if host.encode() in blob:
        print(f"OK: {aab.name} points at {host}")
        return

    print(f"FAIL: {aab.name} does not contain '{host}'.")
    if b"placeholder.supabase.co" in blob and b".supabase.co" not in blob.replace(
        b"placeholder.supabase.co", b""
    ):
        print("      The bundle only has the placeholder fallback — EXPO_PUBLIC_* "
              "vars were not inlined. Check that metro.config.js exists and that "
              "'env: load .env' appears in the bundler output.")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
