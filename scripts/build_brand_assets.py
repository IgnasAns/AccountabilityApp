"""
Build the final Do It Mate brand assets: bold white check on brand red.

Replaces the beer-mug artwork in icon.png, adaptive-icon.png, favicon.png and
the Play feature graphic. splash.png is deliberately left alone — it is already
a fist bump on the dark brand background, which fits.

Sizing rules that matter:
  - Store / app icon: FULL BLEED, no baked-in rounded corners and no alpha.
    Play and the launchers apply their own mask; pre-rounding leaves pale
    corners once the mask is applied on top.
  - Adaptive icon: foreground only, transparent, and the mark must sit inside
    the inner ~66% safe zone or launchers will crop it. The colour moves to
    app.json -> android.adaptiveIcon.backgroundColor.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SS = 4
RED = (217, 75, 61)
WHITE = (250, 250, 247)
DARK = (15, 17, 16)

REPO = Path(r"C:\Projects\AccountabilityApp")
ASSETS = REPO / "assets"
STORE = ASSETS / "store"
OUT_PLAY = ASSETS / "google-play" / "v1.0.11-vc15"


def _check_pts(size, scale=1.0, cx=0.5, cy=0.5):
    """Checkmark vertices, centred on (cx, cy) and scaled about that point."""
    base = [(-0.24, 0.00), (-0.06, 0.18), (0.26, -0.21)]
    return [(int(size * (cx + x * scale)), int(size * (cy + y * scale))) for x, y in base]


def draw_check(d, size, color, scale=1.0, width_frac=0.115, cx=0.5, cy=0.5):
    w = max(1, int(size * width_frac * scale))
    pts = _check_pts(size, scale, cx, cy)
    d.line(pts, fill=color, width=w, joint="curve")
    r = w // 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse((x - r, y - r, x + r, y + r), fill=color)


def icon_full_bleed(px):
    """Square, full bleed, no alpha — for store listing and app icon."""
    n = px * SS
    img = Image.new("RGB", (n, n), RED)
    d = ImageDraw.Draw(img)
    draw_check(d, n, WHITE, scale=1.0)
    return img.resize((px, px), Image.LANCZOS)


def adaptive_foreground(px):
    """Transparent foreground, mark shrunk into the adaptive safe zone."""
    n = px * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Extent works out to ~0.59 of the canvas including stroke, inside the
    # 0.66 adaptive safe circle, so launchers cannot crop the mark.
    draw_check(d, n, WHITE, scale=0.75, width_frac=0.115)
    return img.resize((px, px), Image.LANCZOS)


def load_font(size):
    for name in ("segoeuib.ttf", "arialbd.ttf", "seguisb.ttf", "calibrib.ttf"):
        p = Path(r"C:\Windows\Fonts") / name
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except OSError:
                continue
    return ImageFont.load_default()


def feature_graphic():
    """1024x500 Play feature graphic — mark, wordmark, one line of promise."""
    W, H = 1024 * 2, 500 * 2
    img = Image.new("RGB", (W, H), DARK)
    d = ImageDraw.Draw(img)

    # Brand-red panel on the left holding the mark.
    panel = int(W * 0.30)
    d.rectangle((0, 0, panel, H), fill=RED)

    mark = Image.new("RGBA", (H, H), (0, 0, 0, 0))
    md = ImageDraw.Draw(mark)
    draw_check(md, H, WHITE, scale=0.78)
    mark = mark.resize((int(H * 0.62), int(H * 0.62)), Image.LANCZOS)
    img.paste(mark, (panel // 2 - mark.width // 2, H // 2 - mark.height // 2), mark)

    x = panel + int(W * 0.06)
    title_f = load_font(int(H * 0.20))
    sub_f = load_font(int(H * 0.085))

    d.text((x, int(H * 0.30)), "Do It Mate", font=title_f, fill=WHITE, anchor="lm")
    d.text((x, int(H * 0.55)), "Habit goals with your mates —", font=sub_f, fill=WHITE, anchor="lm")
    d.text((x, int(H * 0.68)), "and real stakes when you slip.", font=sub_f, fill=RED, anchor="lm")

    return img.resize((1024, 500), Image.LANCZOS)


def main():
    written = []

    # Repo assets
    for name, px in (("icon.png", 1024), ("favicon.png", 1024)):
        p = ASSETS / name
        icon_full_bleed(px).save(p, "PNG")
        written.append(p)

    p = ASSETS / "adaptive-icon.png"
    adaptive_foreground(1024).save(p, "PNG")
    written.append(p)

    # Play store assets
    STORE.mkdir(parents=True, exist_ok=True)
    OUT_PLAY.mkdir(parents=True, exist_ok=True)

    p = OUT_PLAY / "icon-512.png"
    icon_full_bleed(512).save(p, "PNG")
    written.append(p)

    fg = feature_graphic()
    for p in (OUT_PLAY / "feature-graphic-1024x500.png", STORE / "feature_graphic.png"):
        fg.save(p, "PNG")
        written.append(p)

    for p in written:
        im = Image.open(p)
        print(f"{str(p.relative_to(REPO)):58} {str(im.size):12} {im.mode}")


if __name__ == "__main__":
    main()
