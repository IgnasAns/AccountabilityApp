#!/usr/bin/env python3
"""
Promote an already-uploaded versionCode to another Play track.

    python scripts/play_promote.py <versionCode> <track> [userFraction]

Use this rather than play_upload.py when the AAB is already on Play — re-uploading
the same versionCode is rejected. Pass userFraction (e.g. 0.2) for a staged
rollout; omit it for a full release.

Committing the edit is what makes the release live, so nothing happens until the
final step; any exception rolls the edit back.
"""

import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build

KEY_FILE = r"C:\Projects\keys\play-publisher.json"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]
PACKAGE = "com.socialledger.app"

RELEASE_NOTES = (
    "Deadline reminders so a missed goal is never a surprise.\n"
    "Delete your account and all its data from Profile.\n"
    "Refreshed look, plus stability and security fixes."
)


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)

    version_code = str(int(sys.argv[1]))
    track = sys.argv[2]
    user_fraction = float(sys.argv[3]) if len(sys.argv) > 3 else None

    creds = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
    svc = build("androidpublisher", "v3", credentials=creds, cache_discovery=False)

    edit_id = svc.edits().insert(body={}, packageName=PACKAGE).execute()["id"]
    print(f"edit {edit_id}")

    try:
        release = {
            "versionCodes": [version_code],
            "releaseNotes": [{"language": "en-US", "text": RELEASE_NOTES}],
        }
        if user_fraction is not None:
            release["status"] = "inProgress"
            release["userFraction"] = user_fraction
        else:
            release["status"] = "completed"

        svc.edits().tracks().update(
            packageName=PACKAGE, editId=edit_id, track=track,
            body={"track": track, "releases": [release]},
        ).execute()

        svc.edits().commit(packageName=PACKAGE, editId=edit_id).execute()

        rollout = "100%" if user_fraction is None else f"{user_fraction:.0%}"
        print(f"COMMITTED — versionCode {version_code} released to {track} at {rollout}.")
    except Exception:
        try:
            svc.edits().delete(packageName=PACKAGE, editId=edit_id).execute()
            print("edit rolled back.")
        except Exception:
            pass
        raise


if __name__ == "__main__":
    main()
