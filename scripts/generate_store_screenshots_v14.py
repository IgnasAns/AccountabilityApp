from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "google-play" / "v1.0.10-vc14"
PHONE_OUT = OUT / "phone-screenshots"
TABLET_7_OUT = OUT / "tablet-7-screenshots"
TABLET_10_OUT = OUT / "tablet-10-screenshots"
FEATURE_OUT = OUT / "feature-graphic-1024x500.png"

COLORS = {
    "bg": (10, 12, 11),
    "bg2": (18, 24, 21),
    "panel": (24, 29, 26),
    "panel2": (31, 38, 34),
    "line": (58, 67, 61),
    "text": (248, 248, 244),
    "muted": (177, 186, 179),
    "primary": (228, 75, 61),
    "primary_dark": (86, 34, 29),
    "success": (61, 202, 119),
    "warning": (239, 175, 63),
    "danger": (228, 75, 61),
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def text_size(value: str, size: int, bold: bool = False) -> tuple[int, int]:
    d = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    box = d.textbbox((0, 0), value, font=font(size, bold))
    return box[2] - box[0], box[3] - box[1]


def wrap(value: str, size: int, width: int, bold: bool = False) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in value.split():
        candidate = word if not current else f"{current} {word}"
        if text_size(candidate, size, bold)[0] <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_text(
    d: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    size: int,
    fill: tuple[int, int, int] = COLORS["text"],
    bold: bool = False,
    anchor: str | None = None,
) -> None:
    d.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)


def rounded(
    d: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int] | tuple[int, int, int, int],
    outline: tuple[int, int, int] | None = None,
    width: int = 1,
) -> None:
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def vertical_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        color = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        for x in range(w):
            px[x, y] = color
    return img.convert("RGBA")


def glow(img: Image.Image, center: tuple[int, int], radius: int, color: tuple[int, int, int], alpha: int) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = center
    d.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*color, alpha))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(radius // 2)))


def shadow(base: Image.Image, box: tuple[int, int, int, int], radius: int, blur: int = 28) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, fill=(0, 0, 0, 160))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)), (0, 16))


def draw_app_icon(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int], scale: int = 1) -> None:
    x1, y1, x2, y2 = box
    rounded(d, box, 28 * scale, COLORS["primary_dark"], None)
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    r = (x2 - x1) // 4
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=COLORS["primary"], width=8 * scale)
    d.line((cx - 36 * scale, cy + 2 * scale, cx - 7 * scale, cy + 32 * scale, cx + 44 * scale, cy - 35 * scale), fill=COLORS["text"], width=9 * scale, joint="curve")


def make_canvas(size: tuple[int, int], title: str, subtitle: str) -> Image.Image:
    img = vertical_gradient(size, COLORS["bg"], (23, 29, 24))
    glow(img, (size[0] - 120, 210), 260, COLORS["primary"], 70)
    glow(img, (120, size[1] - 180), 280, COLORS["success"], 38)
    d = ImageDraw.Draw(img)
    draw_text(d, (72, 82), "Do It Mate!", 32, COLORS["muted"], True)
    draw_text(d, (72, 146), title, 66, COLORS["text"], True)
    y = 245
    for line in wrap(subtitle, 32, size[0] - 150):
        draw_text(d, (74, y), line, 32, COLORS["muted"])
        y += 42
    return img


def phone_frame(img: Image.Image) -> tuple[ImageDraw.ImageDraw, tuple[int, int, int, int]]:
    d = ImageDraw.Draw(img)
    box = (142, 435, 938, 1820)
    shadow(img, box, 54)
    rounded(d, box, 54, (7, 8, 8), COLORS["line"], 3)
    rounded(d, (170, 462, 910, 1788), 40, COLORS["bg"], None)
    draw_text(d, (202, 504), "9:41", 18, COLORS["text"], True)
    d.rounded_rectangle((780, 504, 852, 517), radius=8, fill=COLORS["text"])
    d.rectangle((862, 505, 886, 517), fill=COLORS["text"])
    return d, (170, 462, 910, 1788)


def nav(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int], selected: int = 0) -> None:
    x1, y1, x2, y2 = b
    rounded(d, (x1, y2 - 112, x2, y2), 0, (11, 13, 12), COLORS["line"], 1)
    labels = ["Home", "Explore", "Add", "Activity", "Profile"]
    step = (x2 - x1) / 5
    for i, label in enumerate(labels):
        cx = int(x1 + step * (i + 0.5))
        color = COLORS["primary"] if i == selected else COLORS["muted"]
        d.ellipse((cx - 9, y2 - 78, cx + 9, y2 - 60), fill=color)
        draw_text(d, (cx, y2 - 30), label, 13, color, True, "mm")


def stat(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int], value: str, label: str, color: tuple[int, int, int]) -> None:
    rounded(d, box, 22, COLORS["panel"], COLORS["line"])
    draw_text(d, ((box[0] + box[2]) // 2, box[1] + 48), value, 34, color, True, "mm")
    draw_text(d, ((box[0] + box[2]) // 2, box[1] + 92), label.upper(), 12, COLORS["muted"], True, "mm")


def home_screen(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 70, b[2] - b[0] - 76
    draw_text(d, (x, y), "Hi Alex", 26, COLORS["text"], True)
    draw_text(d, (x, y + 54), "EUR 0.00", 60, COLORS["success"], True)
    draw_text(d, (x, y + 128), "SETTLED UP", 14, COLORS["muted"], True)
    for i, label in enumerate(["Create", "Join", "Profile"]):
        bx = x + i * 220
        rounded(d, (bx, y + 205, bx + 174, y + 318), 26, COLORS["panel"], COLORS["line"])
        draw_text(d, (bx + 87, y + 258), label[0], 26, COLORS["primary"], True, "mm")
        draw_text(d, (bx + 87, y + 294), label, 15, COLORS["text"], True, "mm")
    draw_text(d, (x, y + 388), "Accountability Groups", 22, COLORS["text"], True)
    groups = [("Reading Club", "EUR 1 penalty", "EUR 0.00", COLORS["success"]), ("Morning Runs", "EUR 5 penalty", "EUR 10.00", COLORS["danger"])]
    for i, (name, sub, amount, color) in enumerate(groups):
        top = y + 435 + i * 142
        rounded(d, (x, top, x + w, top + 116), 24, COLORS["panel"], COLORS["line"])
        d.ellipse((x + 24, top + 24, x + 92, top + 92), fill=COLORS["primary_dark"])
        draw_text(d, (x + 58, top + 59), name[0], 28, COLORS["primary"], True, "mm")
        draw_text(d, (x + 116, top + 34), name, 21, COLORS["text"], True)
        draw_text(d, (x + 116, top + 68), sub, 15, COLORS["muted"])
        draw_text(d, (x + w - 26, top + 58), amount, 19, color, True, "rm")
    nav(d, b, 0)


def group_screen(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 62, b[2] - b[0] - 76
    draw_text(d, (x + w // 2, y), "Reading Club", 26, COLORS["text"], True, "ma")
    stat(d, (x, y + 76, x + w // 2 - 14, y + 190), "EUR 1", "Default penalty", COLORS["text"])
    stat(d, (x + w // 2 + 14, y + 76, x + w, y + 190), "EUR 0", "Your balance", COLORS["success"])
    rounded(d, (x, y + 230, x + w, y + 306), 22, COLORS["primary"])
    draw_text(d, (x + w // 2, y + 268), "Log Failure", 20, COLORS["text"], True, "mm")
    draw_text(d, (x, y + 372), "Tasks & Tracking", 23, COLORS["text"], True)
    rounded(d, (x, y + 424, x + w, y + 820), 26, COLORS["panel"], COLORS["line"])
    d.ellipse((x + 28, y + 456, x + 108, y + 536), fill=COLORS["primary_dark"])
    draw_text(d, (x + 68, y + 497), "R", 30, COLORS["primary"], True, "mm")
    draw_text(d, (x + 132, y + 464), "Chapter a day", 24, COLORS["text"], True)
    draw_text(d, (x + 132, y + 508), "7x/week - EUR 1.00", 16, COLORS["muted"])
    badge_left = max(x + 390, x + w - 168)
    rounded(d, (badge_left, y + 482, x + w - 28, y + 534), 16, COLORS["panel2"], COLORS["line"])
    draw_text(d, ((badge_left + x + w - 28) // 2, y + 508), "Goal", 16, COLORS["muted"], True, "mm")
    rounded(d, (x + 28, y + 584, x + w - 28, y + 654), 18, (35, 41, 37), COLORS["line"])
    draw_text(d, (x + 54, y + 620), "Due tomorrow", 18, COLORS["text"], "lm")
    rounded(d, (x + 28, y + 692, x + w - 28, y + 776), 22, COLORS["success"])
    draw_text(d, (x + w // 2, y + 734), "Mark Complete", 22, COLORS["text"], True, "mm")
    nav(d, b, 0)


def proof_screen(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 70, b[2] - b[0] - 76
    draw_text(d, (x, y), "Complete Goal", 30, COLORS["text"], True)
    draw_text(d, (x, y + 48), "Chapter a day", 18, COLORS["muted"])
    rounded(d, (x, y + 128, x + w, y + 210), 20, COLORS["panel"], COLORS["line"])
    draw_text(d, (x + 26, y + 169), "Proof Photo (Optional)", 20, COLORS["text"], True, "lm")
    rounded(d, (x, y + 248, x + w, y + 640), 28, COLORS["panel"], COLORS["line"])
    d.rectangle((x + 34, y + 286, x + w - 34, y + 554), fill=(43, 59, 50))
    d.ellipse((x + 270, y + 350, x + 430, y + 510), outline=COLORS["success"], width=9)
    d.line((x + 312, y + 432, x + 356, y + 476, x + 426, y + 380), fill=COLORS["text"], width=12, joint="curve")
    draw_text(d, (x + w // 2, y + 592), "Add photo proof of completion", 18, COLORS["muted"], False, "mm")
    rounded(d, (x, y + 700, x + w, y + 788), 24, COLORS["success"])
    draw_text(d, (x + w // 2, y + 744), "Complete Goal", 22, COLORS["text"], True, "mm")
    nav(d, b, 2)


def failure_screen(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 70, b[2] - b[0] - 76
    draw_text(d, (x, y), "Log a Failure", 30, COLORS["text"], True)
    draw_text(d, (x, y + 48), "Preview the stakes before confirming", 18, COLORS["muted"])
    rounded(d, (x, y + 130, x + w, y + 452), 28, COLORS["panel"], COLORS["line"])
    draw_text(d, (x + 32, y + 180), "This will create the following debts:", 20, COLORS["text"], True)
    rows = [("Penalty per person", "EUR 1.00"), ("Other members", "x 2"), ("Total debt", "EUR 2.00")]
    for i, (label, value) in enumerate(rows):
        yy = y + 240 + i * 64
        draw_text(d, (x + 32, yy), label, 19, COLORS["muted"])
        draw_text(d, (x + w - 32, yy), value, 21, COLORS["danger"] if i == 2 else COLORS["text"], True, "ra")
    draw_text(d, (x, y + 518), "What happened? (optional)", 18, COLORS["text"], True)
    rounded(d, (x, y + 554, x + w, y + 694), 20, COLORS["panel"], COLORS["line"])
    draw_text(d, (x + 28, y + 596), "Missed today's chapter...", 18, COLORS["muted"])
    rounded(d, (x, y + 752, x + w, y + 840), 24, COLORS["primary"])
    draw_text(d, (x + w // 2, y + 796), "Confirm Failure", 22, COLORS["text"], True, "mm")
    nav(d, b, 2)


def chat_screen(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 70, b[2] - b[0] - 76
    draw_text(d, (x, y), "Reading Club", 30, COLORS["text"], True)
    draw_text(d, (x, y + 48), "Group chat and activity", 18, COLORS["muted"])
    bubbles = [
        ("Maya", "Proof looks good.", False),
        ("You", "Chapter done for today.", True),
        ("Sam", "Nudge sent for tomorrow.", False),
        ("You", "No excuses this week.", True),
    ]
    top = y + 142
    for sender, message, own in bubbles:
        width = 424 if len(message) < 20 else 530
        left = x + w - width if own else x
        fill = COLORS["primary"] if own else COLORS["panel"]
        rounded(d, (left, top, left + width, top + 100), 24, fill, COLORS["line"] if not own else None)
        draw_text(d, (left + 24, top + 28), sender, 14, COLORS["text"], True)
        draw_text(d, (left + 24, top + 66), message, 18, COLORS["text"])
        top += 132
    rounded(d, (x, y + 780, x + w, y + 848), 26, COLORS["panel2"], COLORS["line"])
    draw_text(d, (x + 28, y + 814), "Type a message...", 18, COLORS["muted"], False, "lm")
    nav(d, b, 3)


def balances_screen(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 70, b[2] - b[0] - 76
    draw_text(d, (x, y), "Balances", 30, COLORS["text"], True)
    draw_text(d, (x, y + 48), "Everyone knows where they stand", 18, COLORS["muted"])
    cards = [
        ("You owe", "Maya", "EUR 2.00", COLORS["danger"]),
        ("Owed to you", "Sam", "EUR 5.00", COLORS["success"]),
        ("Settled", "Alex", "EUR 0.00", COLORS["muted"]),
    ]
    top = y + 142
    for title, name, amount, color in cards:
        rounded(d, (x, top, x + w, top + 142), 26, COLORS["panel"], color, 2)
        draw_text(d, (x + 28, top + 34), title.upper(), 13, COLORS["muted"], True)
        draw_text(d, (x + 28, top + 84), name, 23, COLORS["text"], True)
        draw_text(d, (x + w - 28, top + 76), amount, 26, color, True, "ra")
        top += 176
    rounded(d, (x, y + 755, x + w, y + 850), 24, COLORS["panel2"], COLORS["line"])
    draw_text(d, (x + w // 2, y + 802), "Track status. Settle outside the app.", 18, COLORS["muted"], False, "mm")
    nav(d, b, 0)


PHONE_DEFS = [
    ("01-home-dashboard.png", "Accountability that stays visible", "Groups, balances, and progress are clear from the first screen.", home_screen),
    ("02-group-goals.png", "Goals with real stakes", "Set habits, view penalties, and keep daily progress visible.", group_screen),
    ("03-proof-completion.png", "Proof beats promises", "Add optional proof photos when a goal is completed.", proof_screen),
    ("04-failure-preview.png", "Log failures fairly", "Preview penalty totals before a failure is confirmed.", failure_screen),
    ("05-group-chat.png", "Keep the group aligned", "Chat, nudge, and keep the accountability loop moving.", chat_screen),
    ("06-clear-balances.png", "Balances everyone understands", "Track who owes what after missed commitments.", balances_screen),
]


def save_phone_screenshots() -> None:
    PHONE_OUT.mkdir(parents=True, exist_ok=True)
    for filename, title, subtitle, renderer in PHONE_DEFS:
        img = make_canvas((1080, 1920), title, subtitle)
        d, frame = phone_frame(img)
        renderer(d, frame)
        img.convert("RGB").save(PHONE_OUT / filename, optimize=True, quality=95)


def draw_tablet_scene(title: str, subtitle: str, left_renderer, right_renderer) -> Image.Image:
    img = vertical_gradient((2560, 1440), COLORS["bg"], (22, 29, 24))
    glow(img, (2240, 180), 360, COLORS["primary"], 72)
    glow(img, (220, 1240), 340, COLORS["success"], 34)
    d = ImageDraw.Draw(img)
    draw_text(d, (118, 118), "Do It Mate!", 40, COLORS["muted"], True)
    draw_text(d, (118, 210), title, 76, COLORS["text"], True)
    y = 320
    for line in wrap(subtitle, 34, 780):
        draw_text(d, (120, y), line, 34, COLORS["muted"])
        y += 46

    def mini_phone(box: tuple[int, int, int, int], renderer) -> None:
        shadow(img, box, 44)
        rounded(d, box, 44, (7, 8, 8), COLORS["line"], 3)
        inner = (box[0] + 24, box[1] + 24, box[2] - 24, box[3] - 24)
        rounded(d, inner, 30, COLORS["bg"], None)
        draw_text(d, (inner[0] + 30, inner[1] + 40), "9:41", 15, COLORS["text"], True)
        renderer(d, inner)

    mini_phone((1050, 96, 1714, 1338), left_renderer)
    mini_phone((1782, 96, 2446, 1338), right_renderer)
    return img.convert("RGB")


def save_tablet_screenshots() -> None:
    TABLET_7_OUT.mkdir(parents=True, exist_ok=True)
    TABLET_10_OUT.mkdir(parents=True, exist_ok=True)
    scenes = [
        ("01-dashboard-and-goals.png", "Track the whole pact", "Dashboard, groups, goals, and penalties stay visible for everyone.", home_screen, group_screen),
        ("02-proof-and-failures.png", "Proof and penalties", "Record completions, preview failures, and keep accountability fair.", proof_screen, failure_screen),
        ("03-chat-and-balances.png", "Chat plus balances", "Keep communication and settlement status in one place.", chat_screen, balances_screen),
    ]
    for filename, title, subtitle, left, right in scenes:
        img = draw_tablet_scene(title, subtitle, left, right)
        img.save(TABLET_7_OUT / filename, optimize=True, quality=95)
        shutil.copyfile(TABLET_7_OUT / filename, TABLET_10_OUT / filename)


def save_feature_graphic() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    img = vertical_gradient((1024, 500), COLORS["bg"], (25, 31, 27))
    glow(img, (860, 120), 230, COLORS["primary"], 80)
    glow(img, (540, 420), 240, COLORS["success"], 42)
    d = ImageDraw.Draw(img)
    draw_app_icon(d, (72, 70, 196, 194))
    draw_text(d, (72, 254), "Do It Mate!", 62, COLORS["text"], True)
    draw_text(d, (76, 328), "Goals. Proof. Group stakes.", 30, COLORS["muted"], True)
    rounded(d, (590, 72, 938, 428), 36, COLORS["panel"], COLORS["line"], 2)
    draw_text(d, (624, 126), "Reading Club", 28, COLORS["text"], True)
    rounded(d, (624, 184, 904, 256), 20, COLORS["primary_dark"], COLORS["primary"], 2)
    draw_text(d, (652, 222), "Log Failure", 22, COLORS["text"], True, "lm")
    rounded(d, (624, 288, 904, 360), 20, (27, 61, 42), COLORS["success"], 2)
    draw_text(d, (652, 326), "Mark Complete", 22, COLORS["text"], True, "lm")
    img.convert("RGB").save(FEATURE_OUT, optimize=True, quality=95)


def main() -> None:
    save_phone_screenshots()
    save_tablet_screenshots()
    save_feature_graphic()


if __name__ == "__main__":
    main()
