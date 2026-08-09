#!/usr/bin/env python3
"""
Read or update the Do It Mate Play store listing via the Android Publisher API.

The Console's asset picker does not reliably bind an uploaded image to its slot
under browser automation, so images go through the API instead. Listing text is
included in the same edit so one commit leaves everything consistent — an API
edit is created from the published state, so text set only in an unsent Console
draft could otherwise be dropped.

    python play_listing.py read      # show current listing + image counts
    python play_listing.py stage     # create edit, apply text + images, DON'T commit
    python play_listing.py commit    # same as stage, then commit (sends for review)

Nothing is sent for review unless 'commit' is passed explicitly.
"""

import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

KEY_FILE = r"C:\Projects\keys\play-publisher.json"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]
PACKAGE = "com.socialledger.app"
LANG = "en-US"

REPO = Path(r"C:\Projects\AccountabilityApp")
PLAY = REPO / "assets" / "google-play"
NEW = PLAY / "v1.0.11-vc15"
OLD = PLAY / "v1.0.10-vc14"

TITLE = "Do It Mate: Habit Tracker"
SHORT = "Habit tracker for friends. Miss one, owe the group. Photo proof keeps it real."
FULL = (REPO / "scripts" / "store_full_description.txt").read_text(encoding="utf-8").strip()

# imageType -> list of files. Order is the order shown on the listing.
IMAGES = {
    "icon": [NEW / "icon-512.png"],
    "featureGraphic": [NEW / "feature-graphic-1024x500.png"],
    "sevenInchScreenshots": sorted((OLD / "tablet-7-screenshots").glob("*.png")),
    "tenInchScreenshots": sorted((OLD / "tablet-10-screenshots").glob("*.png")),
}


def service():
    creds = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
    return build("androidpublisher", "v3", credentials=creds, cache_discovery=False)


def do_read(svc):
    edit_id = svc.edits().insert(body={}, packageName=PACKAGE).execute()["id"]
    try:
        listing = svc.edits().listings().get(
            packageName=PACKAGE, editId=edit_id, language=LANG
        ).execute()

        print("=== CURRENT LISTING ===")
        print(f"title  ({len(listing.get('title',''))}/30): {listing.get('title')}")
        print(f"short  ({len(listing.get('shortDescription',''))}/80): {listing.get('shortDescription')}")
        print(f"full   ({len(listing.get('fullDescription',''))}/4000 chars)")
        print()
        print("=== CURRENT IMAGES ===")
        for image_type in ("icon", "featureGraphic", "phoneScreenshots",
                           "sevenInchScreenshots", "tenInchScreenshots"):
            try:
                res = svc.edits().images().list(
                    packageName=PACKAGE, editId=edit_id,
                    language=LANG, imageType=image_type
                ).execute()
                imgs = res.get("images", []) or []
                print(f"  {image_type:24} {len(imgs)}")
            except HttpError as exc:
                print(f"  {image_type:24} ERROR {exc.resp.status}")
    finally:
        svc.edits().delete(packageName=PACKAGE, editId=edit_id).execute()


def do_write(svc, commit):
    missing = [str(p) for files in IMAGES.values() for p in files if not p.exists()]
    if missing:
        raise SystemExit("Missing image file(s):\n  " + "\n  ".join(missing))

    assert len(TITLE) <= 30, len(TITLE)
    assert len(SHORT) <= 80, len(SHORT)
    assert len(FULL) <= 4000, len(FULL)

    edit_id = svc.edits().insert(body={}, packageName=PACKAGE).execute()["id"]
    print(f"edit {edit_id}")

    try:
        svc.edits().listings().update(
            packageName=PACKAGE, editId=edit_id, language=LANG,
            body={
                "language": LANG,
                "title": TITLE,
                "shortDescription": SHORT,
                "fullDescription": FULL,
            },
        ).execute()
        print(f"  text updated (title {len(TITLE)}/30, short {len(SHORT)}/80, full {len(FULL)}/4000)")

        for image_type, files in IMAGES.items():
            # Clear the slot first: icon/featureGraphic are single-valued and
            # screenshots would otherwise accumulate alongside the old set.
            svc.edits().images().deleteall(
                packageName=PACKAGE, editId=edit_id,
                language=LANG, imageType=image_type
            ).execute()

            for path in files:
                svc.edits().images().upload(
                    packageName=PACKAGE, editId=edit_id,
                    language=LANG, imageType=image_type,
                    media_body=MediaFileUpload(str(path), mimetype="image/png"),
                ).execute()
            print(f"  {image_type:24} <- {len(files)} file(s)")

        if commit:
            svc.edits().commit(packageName=PACKAGE, editId=edit_id).execute()
            print("COMMITTED — changes sent to Google for review.")
        else:
            svc.edits().validate(packageName=PACKAGE, editId=edit_id).execute()
            print("VALIDATED (not committed). Re-run with 'commit' to send for review.")
            svc.edits().delete(packageName=PACKAGE, editId=edit_id).execute()
            print("staging edit discarded.")
    except Exception:
        try:
            svc.edits().delete(packageName=PACKAGE, editId=edit_id).execute()
            print("edit rolled back.")
        except Exception:
            pass
        raise


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "read"
    svc = service()
    if mode == "read":
        do_read(svc)
    elif mode == "stage":
        do_write(svc, commit=False)
    elif mode == "commit":
        do_write(svc, commit=True)
    else:
        raise SystemExit(__doc__)
