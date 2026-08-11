"""
Concatenate the Supabase SQL files into a single paste-able bootstrap script.

Why this exists: the original backend was lost once already, and recovering it
meant running seven files in a specific, undocumented-by-the-tooling order. One
file removes that failure mode — paste `supabase/bootstrap.sql` into the SQL
editor of a brand-new project and the schema is complete.

Most statements in the source files are already idempotent (CREATE TABLE IF NOT
EXISTS, CREATE OR REPLACE FUNCTION), but 42 of the 48 RLS policies are bare
`CREATE POLICY` with no preceding drop. Those succeed on a fresh database and
fail on any re-run with "policy already exists". Rather than editing six
working SQL files, this generator injects `DROP POLICY IF EXISTS` ahead of every
`CREATE POLICY` it emits, which makes the bundle re-runnable.

Usage:  python scripts/build_bootstrap_sql.py
Output: supabase/bootstrap.sql
"""

import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SQL_DIR = ROOT / "supabase"
OUT = SQL_DIR / "bootstrap.sql"

# Order matters: base schema, then features, then migrations by number.
ORDER = [
    "full_setup.sql",
    "photo_proof_setup.sql",
    "scheduled_goals_setup.sql",
    "group_chat_setup.sql",
    "auto_failure_setup.sql",
    "enhanced_goals_setup.sql",
    "migrations/007_activity_log_and_enhancements.sql",
    "migrations/008_missing_activity_triggers.sql",
    "migrations/010_rls_and_server_fixes.sql",
    "migrations/011_fix_log_failure_balance.sql",
    "migrations/012_push_notifications.sql",
    "migrations/013_secure_goal_templates.sql",
    "migrations/014_account_deletion.sql",
    "migrations/015_security_hardening.sql",
    "migrations/016_fixes_audit_qa.sql",
    "migrations/017_public_challenges.sql",
    "migrations/018_freemium.sql",
]

HEADER = f"""-- ============================================================================
-- Do It Mate! — COMPLETE DATABASE BOOTSTRAP
-- Generated {date.today().isoformat()} by scripts/build_bootstrap_sql.py
-- DO NOT EDIT BY HAND — edit the source files and regenerate.
--
-- Paste this whole file into the Supabase SQL editor of a fresh project, or:
--     psql "$DATABASE_URL" -f supabase/bootstrap.sql
--
-- Safe to re-run: policy drops are injected by the generator.
--
-- AFTER running this, in the Supabase dashboard:
--   1. Authentication > Providers > enable Email (and Anonymous, for guest mode)
--   2. Authentication > URL Configuration > add redirect: doitmate://reset-password
--   3. Storage: buckets are created by the SQL below; verify they exist
-- ============================================================================

"""


# Matches the opening of a policy definition, capturing its name and table.
# Verified that no CREATE POLICY in these files sits inside a dollar-quoted
# function body, so a plain textual injection is safe.
CREATE_POLICY = re.compile(
    r'CREATE\s+POLICY\s+"(?P<name>[^"]+)"\s+ON\s+(?P<table>[A-Za-z_][A-Za-z0-9_.]*)',
    re.IGNORECASE,
)


def guard_policies(sql: str) -> tuple[str, int]:
    """Prefix every CREATE POLICY with a matching DROP POLICY IF EXISTS.

    Injecting unconditionally is intentional: a redundant drop is a no-op, and
    that is far easier to reason about than tracking which policies already
    have a guard somewhere earlier in the file.
    """
    injected = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal injected
        injected += 1
        name = match.group("name")
        table = match.group("table")
        return f'DROP POLICY IF EXISTS "{name}" ON {table};\n{match.group(0)}'

    return CREATE_POLICY.sub(replace, sql), injected


def main() -> None:
    missing = [name for name in ORDER if not (SQL_DIR / name).exists()]
    if missing:
        raise SystemExit(f"Missing SQL source file(s): {', '.join(missing)}")

    chunks = [HEADER]
    total_guards = 0

    for name in ORDER:
        body = (SQL_DIR / name).read_text(encoding="utf-8").strip()
        body, injected = guard_policies(body)
        total_guards += injected
        banner = "-" * 76
        chunks.append(
            f"-- {banner}\n"
            f"-- SOURCE: supabase/{name}\n"
            f"-- {banner}\n\n"
            f"{body}\n\n"
        )

    OUT.write_text("".join(chunks), encoding="utf-8")

    lines = OUT.read_text(encoding="utf-8").count("\n")
    kb = OUT.stat().st_size / 1024
    print(f"Wrote {OUT.relative_to(ROOT)} from {len(ORDER)} files ({lines} lines, {kb:.1f} KB)")
    print(f"Injected {total_guards} DROP POLICY IF EXISTS guard(s)")


if __name__ == "__main__":
    main()
