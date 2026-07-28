#!/usr/bin/env python3
"""
Upload a release AAB to Google Play via the Android Publisher API.

    python scripts/play_upload.py <path-to-aab> [track]

track defaults to "internal". Use "production" only once the build has been
eyeballed on a real device — v1.0.11 is the first build to target API 36, which
forces edge-to-edge, and no amount of static checking substitutes for looking
at the screens.

Nothing reaches users until the edit is committed, which this script does at the
end; an exception anywhere rolls the edit back.
"""

import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

KEY_FILE = r"C:\Projects\keys\play-publisher.json"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]
PACKAGE = "com.socialledger.app"

VALID_TRACKS = ("internal", "alpha", "beta", "production")


def service():
    creds = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
    return build("androidpublisher", "v3", credentials=creds, cache_discovery=False)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)

    aab = Path(sys.argv[1])
    track = sys.argv[2] if len(sys.argv) > 2 else "internal"

    if not aab.exists():
        raise SystemExit(f"AAB not found: {aab}")
    if track not in VALID_TRACKS:
        raise SystemExit(f"track must be one of {VALID_TRACKS}, got {track!r}")

    svc = service()
    edit_id = svc.edits().insert(body={}, packageName=PACKAGE).execute()["id"]
    print(f"edit {edit_id}")

    try:
        print(f"uploading {aab.name} ({aab.stat().st_size / 1_048_576:.1f} MB)...")
        bundle = svc.edits().bundles().upload(
            packageName=PACKAGE,
            editId=edit_id,
            media_body=MediaFileUpload(str(aab), mimetype="application/octet-stream", resumable=True),
        ).execute()

        version_code = bundle["versionCode"]
        print(f"  uploaded versionCode {version_code}")

        svc.edits().tracks().update(
            packageName=PACKAGE,
            editId=edit_id,
            track=track,
            body={
                "track": track,
                "releases": [{
                    "versionCodes": [str(version_code)],
                    "status": "completed",
                    "releaseNotes": [{
                        "language": "en-US",
                        "text": (
                            "Deadline reminders so a missed goal is never a surprise.\n"
                            "Delete your account and all its data from Profile.\n"
                            "Refreshed look, plus stability and security fixes."
                        ),
                    }],
                }],
            },
        ).execute()
        print(f"  assigned to track: {track}")

        svc.edits().commit(packageName=PACKAGE, editId=edit_id).execute()
        print(f"COMMITTED — versionCode {version_code} is on the {track} track.")
    except Exception:
        try:
            svc.edits().delete(packageName=PACKAGE, editId=edit_id).execute()
            print("edit rolled back.")
        except Exception:
            pass
        raise


if __name__ == "__main__":
    main()
