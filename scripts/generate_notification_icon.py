"""
Generate the Android notification icon.

Android masks notification icons to a single colour and keeps only the alpha
channel, so a detailed full-colour app icon renders as a solid blob. This draws
a purpose-built 96x96 white-on-transparent glyph instead: a checkmark inside a
rounded square, matching the "commitment kept" idea of the app.

Usage:  python scripts/generate_notification_icon.py
Output: assets/notification-icon.png
"""

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 96          # Android xxhdpi baseline for notification icons
MARGIN = 10        # keep clear of the system's own padding
STROKE = 9

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "notification-icon.png"


def main() -> None:
    # 4x supersample, then downscale — Pillow has no antialiased line drawing.
    scale = 4
    canvas = Image.new("RGBA", (SIZE * scale, SIZE * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    m = MARGIN * scale
    s = STROKE * scale
    box = (m, m, SIZE * scale - m, SIZE * scale - m)

    # Rounded square outline.
    draw.rounded_rectangle(box, radius=18 * scale, outline=(255, 255, 255, 255), width=s)

    # Checkmark, proportional to the box so it stays centred.
    left, top, right, bottom = box
    w = right - left
    h = bottom - top
    check = [
        (left + w * 0.26, top + h * 0.52),
        (left + w * 0.44, top + h * 0.70),
        (left + w * 0.76, top + h * 0.32),
    ]
    draw.line(check, fill=(255, 255, 255, 255), width=s, joint="curve")

    # Round the checkmark's ends so it doesn't look chiselled.
    r = s // 2
    for x, y in (check[0], check[-1]):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, 255))

    icon = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    icon.save(OUT, "PNG")
    print(f"Wrote {OUT.relative_to(ROOT)} ({SIZE}x{SIZE}, white on transparent)")


if __name__ == "__main__":
    main()
