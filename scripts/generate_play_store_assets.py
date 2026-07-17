from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "google-play"
SCREEN_OUT = OUT / "phone-screenshots"
AI_SOURCE = Path(
    r"C:\Users\Ignas\.codex\generated_images\019dcdd1-54ef-7ac2-8a8a-57e5fe546f2f"
    r"\ig_058ec5f8eff9f4fc0169ef15fa409c8191918b56c9ff0537f6.png"
)

COLORS = {
    "bg": (20, 23, 31),
    "bg2": (38, 44, 52),
    "surface": (33, 37, 43),
    "surface2": (52, 59, 71),
    "primary": (59, 130, 246),
    "primary2": (34, 211, 238),
    "success": (74, 222, 128),
    "warning": (251, 191, 36),
    "danger": (248, 113, 113),
    "text": (255, 255, 255),
    "muted": (157, 165, 180),
    "border": (75, 82, 99),
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def gradient(size: tuple[int, int], start: tuple[int, int, int], end: tuple[int, int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x / max(w - 1, 1)) * 0.7 + (y / max(h - 1, 1)) * 0.3
            px[x, y] = tuple(int(start[i] * (1 - t) + end[i] * t) for i in range(3))
    return img


def add_glow(img: Image.Image, center: tuple[int, int], radius: int, color: tuple[int, int, int], alpha: int) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = center
    d.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius // 2))
    img.alpha_composite(layer)


def rounded(
    d: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int] | tuple[int, int, int, int],
    outline: tuple[int, int, int] | None = None,
    width: int = 1,
) -> None:
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(
    d: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    size: int,
    fill: tuple[int, int, int] = COLORS["text"],
    bold: bool = False,
    anchor: str | None = None,
) -> None:
    d.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)


def text_width(value: str, size: int, bold: bool = False) -> int:
    box = ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox((0, 0), value, font=font(size, bold))
    return box[2] - box[0]


def wrap(value: str, size: int, width: int, bold: bool = False) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in value.split():
        candidate = word if not current else f"{current} {word}"
        if text_width(candidate, size, bold) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def shadow_card(base: Image.Image, box: tuple[int, int, int, int], radius: int, blur: int = 22) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, fill=(0, 0, 0, 135))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer, (0, 10))


def draw_check(d: ImageDraw.ImageDraw, points: tuple[int, int, int, int, int, int], fill: tuple[int, int, int], width: int) -> None:
    d.line(points, fill=fill, width=width, joint="curve")


def draw_icon() -> None:
    img = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    base = gradient((512, 512), (20, 24, 34), (18, 90, 92)).convert("RGBA")
    img.alpha_composite(base)
    add_glow(img, (388, 122), 180, COLORS["primary"], 130)
    add_glow(img, (112, 392), 160, COLORS["success"], 95)
    d = ImageDraw.Draw(img)

    d.ellipse((96, 92, 416, 412), fill=(17, 21, 29, 212), outline=(75, 228, 172, 185), width=10)
    d.ellipse((155, 151, 357, 353), outline=(59, 130, 246, 220), width=16)
    d.ellipse((220, 216, 292, 288), fill=(74, 222, 128, 235))
    draw_check(d, (178, 261, 233, 318, 342, 202), COLORS["text"], 34)
    d.ellipse((130, 324, 195, 389), fill=(59, 130, 246, 225))
    d.ellipse((317, 324, 382, 389), fill=(74, 222, 128, 225))
    d.rounded_rectangle((176, 361, 336, 402), radius=20, fill=(255, 255, 255, 42))

    img.save(OUT / "app-icon-512.png", optimize=True)


def draw_feature() -> None:
    img = gradient((1024, 500), (20, 24, 34), (22, 74, 92)).convert("RGBA")
    add_glow(img, (785, 125), 220, COLORS["primary"], 105)
    add_glow(img, (610, 420), 210, COLORS["success"], 70)
    d = ImageDraw.Draw(img)

    if AI_SOURCE.exists():
        (OUT / "_source-ai-illustration.png").write_bytes(AI_SOURCE.read_bytes())

    rounded(d, (56, 74, 464, 426), 36, (15, 19, 29, 174), (88, 101, 122), 2)
    text(d, (94, 128), "Do It Mate!", 58, bold=True)
    text(d, (96, 201), "Goals need proof.", 31, COLORS["success"], bold=True)
    text(d, (96, 245), "Groups, photo proof, penalties,\nand leaderboards in one app.", 25, COLORS["text"])
    rounded(d, (96, 345, 303, 388), 21, (*COLORS["primary"], 255))
    text(d, (200, 367), "Stay accountable", 20, COLORS["text"], bold=True, anchor="mm")

    # Abstract app-experience cards. No device frames, app-store badges, or rankings.
    rounded(d, (540, 78, 948, 410), 44, (15, 20, 29, 210), (74, 222, 128), 2)
    d.ellipse((610, 126, 820, 336), outline=COLORS["primary"], width=16)
    d.ellipse((660, 176, 770, 286), outline=COLORS["success"], width=12)
    draw_check(d, (655, 246, 706, 296, 796, 195), COLORS["text"], 23)
    rounded(d, (772, 116, 915, 178), 18, (33, 37, 43), COLORS["border"])
    text(d, (792, 148), "Proof", 21, COLORS["text"], bold=True, anchor="lm")
    rounded(d, (772, 204, 915, 266), 18, (33, 37, 43), COLORS["border"])
    text(d, (792, 236), "EUR 10", 21, COLORS["danger"], bold=True, anchor="lm")
    rounded(d, (772, 292, 915, 354), 18, (33, 37, 43), COLORS["border"])
    text(d, (792, 324), "Streak", 21, COLORS["success"], bold=True, anchor="lm")

    Image.alpha_composite(img, Image.new("RGBA", img.size, (0, 0, 0, 0))).convert("RGB").save(
        OUT / "feature-graphic-1024x500.png", optimize=True
    )


def phone_base(title: str, subtitle: str, accent: tuple[int, int, int]) -> Image.Image:
    img = gradient((1080, 1920), (18, 21, 29), (25, 49, 63)).convert("RGBA")
    add_glow(img, (910, 210), 250, accent, 90)
    add_glow(img, (140, 1780), 270, COLORS["primary"], 75)
    d = ImageDraw.Draw(img)
    text(d, (86, 98), "Do It Mate!", 32, COLORS["muted"], bold=True)
    text(d, (86, 160), title, 72, COLORS["text"], bold=True)
    y = 260
    for line in wrap(subtitle, 32, 770):
        text(d, (88, y), line, 32, COLORS["muted"])
        y += 42
    return img


def draw_nav(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = box
    d.rounded_rectangle((x1 + 40, y2 - 90, x2 - 40, y2 - 20), radius=26, fill=(20, 24, 34))
    labels = ["Home", "Explore", "Add", "Activity", "Profile"]
    for i, label in enumerate(labels):
        cx = x1 + 80 + i * ((x2 - x1 - 160) // 4)
        color = COLORS["primary"] if i == 0 else COLORS["muted"]
        d.ellipse((cx - 7, y2 - 69, cx + 7, y2 - 55), fill=color)
        text(d, (cx, y2 - 38), label, 13, color, anchor="mm", bold=i == 0)


def draw_phone_shell(img: Image.Image) -> tuple[ImageDraw.ImageDraw, tuple[int, int, int, int]]:
    d = ImageDraw.Draw(img)
    box = (90, 430, 990, 1840)
    shadow_card(img, box, 42, blur=24)
    rounded(d, box, 42, (15, 17, 22), COLORS["border"], 3)
    text(d, (128, 473), "9:41", 18, COLORS["text"], bold=True)
    d.rounded_rectangle((830, 473, 920, 486), radius=8, fill=COLORS["text"])
    d.rectangle((930, 474, 958, 486), fill=COLORS["text"])
    return d, box


def ui_header(d: ImageDraw.ImageDraw, x: int, y: int, heading: str, sub: str = "") -> None:
    text(d, (x, y), heading, 25, COLORS["text"], bold=True)
    if sub:
        text(d, (x, y + 34), sub, 15, COLORS["muted"])


def draw_stat_card(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int], value: str, label: str, color: tuple[int, int, int]) -> None:
    rounded(d, box, 20, COLORS["surface"], COLORS["border"], 1)
    text(d, ((box[0] + box[2]) // 2, box[1] + 45), value, 35, color, bold=True, anchor="mm")
    text(d, ((box[0] + box[2]) // 2, box[1] + 88), label, 13, COLORS["muted"], bold=True, anchor="mm")


def draw_home(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 62, b[2] - b[0] - 76
    ui_header(d, x, y, "Home", "Your group accountability dashboard")
    text(d, (b[0] + 358, y + 152), "+EUR 0.00", 45, COLORS["success"], bold=True, anchor="mm")
    text(d, (b[0] + 358, y + 205), "SETTLED UP", 16, COLORS["muted"], bold=True, anchor="mm")
    for i, (label, icon) in enumerate([("Create", "+"), ("Join", "link"), ("Profile", "me")]):
        bx = x + i * 230
        rounded(d, (bx, y + 275, bx + 180, y + 375), 24, COLORS["surface"], COLORS["border"])
        text(d, (bx + 90, y + 318), icon, 22, COLORS["primary"], bold=True, anchor="mm")
        text(d, (bx + 90, y + 354), label, 15, COLORS["muted"], bold=True, anchor="mm")
    text(d, (x, y + 440), "Accountability Groups", 20, COLORS["text"], bold=True)
    for i, (name, amount, color) in enumerate([("Gym Squad", "EUR 10.00", COLORS["danger"]), ("Study Crew", "EUR 0.00", COLORS["muted"]), ("No Sugar Pact", "+EUR 5.00", COLORS["success"])]):
        top = y + 486 + i * 134
        rounded(d, (x, top, x + w, top + 108), 22, COLORS["surface"], COLORS["border"])
        d.ellipse((x + 24, top + 24, x + 84, top + 84), fill=COLORS["surface2"])
        text(d, (x + 54, top + 54), name[0], 25, COLORS["text"], bold=True, anchor="mm")
        text(d, (x + 105, top + 34), name, 20, COLORS["text"], bold=True)
        text(d, (x + 105, top + 65), "EUR 5 penalty", 14, COLORS["muted"])
        text(d, (x + w - 28, top + 54), amount, 18, color, bold=True, anchor="rm")
    draw_nav(d, b)


def draw_create_group(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 64, b[2] - b[0] - 76
    ui_header(d, x, y, "Create a Group", "Set the pact and invite your mates")
    fields = [("Group Name", "Gym Squad"), ("Description", "3 workouts per week. Photo proof required."), ("Penalty Amount", "EUR 10")]
    for i, (label, val) in enumerate(fields):
        top = y + 110 + i * 172
        text(d, (x, top), label, 17, COLORS["text"], bold=True)
        rounded(d, (x, top + 35, x + w, top + 118), 18, COLORS["surface"], COLORS["border"])
        text(d, (x + 24, top + 83), val, 19, COLORS["text"], anchor="lm")
    text(d, (x, y + 628), "Quick stakes", 17, COLORS["text"], bold=True)
    for i, amt in enumerate(["EUR 1", "EUR 2", "EUR 5", "EUR 10"]):
        bx = x + i * 164
        fill = (*COLORS["primary"], 255) if amt == "EUR 10" else COLORS["surface"]
        rounded(d, (bx, y + 672, bx + 138, y + 728), 18, fill, COLORS["border"])
        text(d, (bx + 69, y + 701), amt, 16, COLORS["text"], bold=True, anchor="mm")
    rounded(d, (x, y + 830, x + w, y + 908), 22, COLORS["primary"])
    text(d, (x + w // 2, y + 870), "Create Group", 21, COLORS["text"], bold=True, anchor="mm")
    draw_nav(d, b)


def draw_tasks(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 64, b[2] - b[0] - 76
    ui_header(d, x, y, "Gym Squad", "Dashboard")
    draw_stat_card(d, (x, y + 88, x + 318, y + 210), "EUR 10", "Default Penalty", COLORS["text"])
    draw_stat_card(d, (x + 340, y + 88, x + w, y + 210), "EUR 0", "Your Balance", COLORS["success"])
    rounded(d, (x, y + 250, x + w, y + 314), 18, (80, 35, 42), COLORS["danger"])
    text(d, (x + w // 2, y + 282), "Log Failure", 19, COLORS["danger"], bold=True, anchor="mm")
    text(d, (x, y + 370), "Tasks & Tracking", 22, COLORS["text"], bold=True)
    for i, (name, sub, color, button) in enumerate([
        ("Gym 3x/week", "Due tomorrow - EUR 10", COLORS["warning"], "Mark Complete"),
        ("No Sugar", "Clean today - EUR 2 per slip-up", COLORS["success"], "I Slipped Up"),
    ]):
        top = y + 420 + i * 250
        rounded(d, (x, top, x + w, top + 218), 24, COLORS["surface"], color, 2)
        d.ellipse((x + 26, top + 26, x + 86, top + 86), fill=(*color, 80))
        draw_check(d, (x + 39, top + 58, x + 54, top + 73, x + 75, top + 42), color, 6)
        text(d, (x + 110, top + 35), name, 21, COLORS["text"], bold=True)
        text(d, (x + 110, top + 68), sub, 15, COLORS["muted"])
        rounded(d, (x + 24, top + 140, x + w - 24, top + 194), 17, color)
        text(d, (x + w // 2, top + 167), button, 16, COLORS["text"], bold=True, anchor="mm")
    draw_nav(d, b)


def draw_photo(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 64, b[2] - b[0] - 76
    ui_header(d, x, y, "Complete Goal", "Gym 3x/week")
    rounded(d, (x, y + 120, x + w, y + 210), 18, (32, 48, 64), COLORS["primary"])
    text(d, (x + 28, y + 166), "Photo proof is required", 21, COLORS["primary"], bold=True, anchor="lm")
    rounded(d, (x, y + 260, x + w, y + 760), 28, COLORS["surface"], COLORS["border"])
    d.rectangle((x + 28, y + 300, x + w - 28, y + 690), fill=(45, 75, 82))
    for i in range(6):
        d.line((x + 28, y + 690 - i * 45, x + w - 28, y + 615 - i * 26), fill=(70, 104, 103), width=4)
    d.ellipse((x + 255, y + 410, x + 405, y + 560), outline=COLORS["text"], width=12)
    d.rounded_rectangle((x + 288, y + 455, x + 372, y + 520), radius=12, outline=COLORS["text"], width=8)
    text(d, (x + w // 2, y + 720), "Proof photo selected", 20, COLORS["success"], bold=True, anchor="mm")
    rounded(d, (x, y + 840, x + w, y + 912), 21, COLORS["success"])
    text(d, (x + w // 2, y + 877), "Complete with Photo", 21, COLORS["text"], bold=True, anchor="mm")
    draw_nav(d, b)


def draw_leaderboard(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 64, b[2] - b[0] - 76
    ui_header(d, x, y, "Leaderboard", "Progress that everyone can see")
    for i, (name, points, color) in enumerate([("Maya", "820", COLORS["success"]), ("Alex", "760", COLORS["primary"]), ("You", "710", COLORS["warning"]), ("Jonas", "590", COLORS["muted"])]):
        top = y + 125 + i * 145
        rounded(d, (x, top, x + w, top + 112), 22, COLORS["surface"], COLORS["border"])
        text(d, (x + 34, top + 56), str(i + 1), 29, color, bold=True, anchor="mm")
        d.ellipse((x + 78, top + 28, x + 136, top + 86), fill=COLORS["surface2"])
        text(d, (x + 107, top + 57), name[0], 24, COLORS["text"], bold=True, anchor="mm")
        text(d, (x + 160, top + 40), name, 21, COLORS["text"], bold=True)
        text(d, (x + 160, top + 72), "Streak active", 15, COLORS["muted"])
        text(d, (x + w - 26, top + 56), points, 25, color, bold=True, anchor="rm")
    draw_nav(d, b)


def draw_balances(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 64, b[2] - b[0] - 76
    ui_header(d, x, y, "Balances", "Know who owes what")
    sections = [
        ("You Owe", [("Maya", "EUR 10.00"), ("Alex", "EUR 5.00")], COLORS["danger"]),
        ("Owed to You", [("Jonas", "EUR 15.00")], COLORS["success"]),
    ]
    top = y + 118
    for title, rows, color in sections:
        text(d, (x, top), title, 22, COLORS["text"], bold=True)
        top += 48
        for name, amount in rows:
            rounded(d, (x, top, x + w, top + 108), 20, (*color, 34), color, 2)
            text(d, (x + 28, top + 37), name, 21, COLORS["text"], bold=True)
            text(d, (x + 28, top + 72), "Logged failure", 15, COLORS["muted"])
            text(d, (x + w - 28, top + 54), amount, 20, color, bold=True, anchor="rm")
            top += 132
        top += 34
    rounded(d, (x, y + 780, x + w, y + 890), 24, COLORS["surface"], COLORS["border"])
    text(d, (x + w // 2, y + 832), "Payments are settled between members", 19, COLORS["muted"], anchor="mm")
    draw_nav(d, b)


def draw_chat(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 64, b[2] - b[0] - 76
    ui_header(d, x, y, "Group Chat", "Nudge, comment, and keep momentum")
    bubbles = [
        ("Maya", "Proof looks good.", False),
        ("You", "Gym done. Uploading now.", True),
        ("Alex", "Nudge sent for today's goal.", False),
        ("You", "No excuses today.", True),
    ]
    top = y + 135
    for sender, message, own in bubbles:
        width = 450 if len(message) < 22 else 560
        left = x + w - width if own else x
        fill = COLORS["primary"] if own else COLORS["surface"]
        rounded(d, (left, top, left + width, top + 104), 24, fill, None)
        text(d, (left + 24, top + 30), sender, 15, COLORS["text"] if own else COLORS["primary"], bold=True)
        text(d, (left + 24, top + 68), message, 18, COLORS["text"])
        top += 140
    rounded(d, (x, y + 832, x + w, y + 898), 28, COLORS["surface2"], COLORS["border"])
    text(d, (x + 28, y + 865), "Type a message...", 18, COLORS["muted"], anchor="lm")
    draw_nav(d, b)


def draw_profile(d: ImageDraw.ImageDraw, b: tuple[int, int, int, int]) -> None:
    x, y, w = b[0] + 38, b[1] + 64, b[2] - b[0] - 76
    d.ellipse((x + 258, y + 48, x + 398, y + 188), fill=COLORS["surface2"], outline=COLORS["primary"], width=4)
    text(d, (x + 328, y + 118), "A", 64, COLORS["primary"], bold=True, anchor="mm")
    text(d, (x + w // 2, y + 230), "Your Profile", 28, COLORS["text"], bold=True, anchor="mm")
    text(d, (x + w // 2, y + 270), "Payment links and identity", 17, COLORS["muted"], anchor="mm")
    for i, (label, val) in enumerate([("Display Name", "Alex"), ("Payment Link", "paypal.me/alex")]):
        top = y + 355 + i * 170
        text(d, (x, top), label, 17, COLORS["muted"], bold=True)
        rounded(d, (x, top + 36, x + w, top + 118), 18, COLORS["surface"], COLORS["border"])
        text(d, (x + 24, top + 78), val, 20, COLORS["text"], anchor="lm")
    rounded(d, (x, y + 760, x + w, y + 834), 20, COLORS["primary"])
    text(d, (x + w // 2, y + 798), "Save Changes", 21, COLORS["text"], bold=True, anchor="mm")
    text(d, (x + w // 2, y + 922), "Do It Mate! v1.0.3", 16, COLORS["muted"], anchor="mm")
    draw_nav(d, b)


SCREEN_DEFS = [
    ("01-home-dashboard.png", "See every pact", "Track groups, balances, and accountability from one clean dashboard.", COLORS["primary"], draw_home),
    ("02-create-group.png", "Create a pact fast", "Set a group, add stakes, and invite your mates in seconds.", COLORS["success"], draw_create_group),
    ("03-tasks-tracking.png", "Goals with stakes", "Positive habits and slip-up trackers keep the group honest.", COLORS["warning"], draw_tasks),
    ("04-photo-proof.png", "Proof beats promises", "Require completion photos so progress is visible to everyone.", COLORS["primary2"], draw_photo),
    ("05-leaderboard.png", "Friendly pressure", "Leaderboard progress makes consistency easy to spot.", COLORS["success"], draw_leaderboard),
    ("06-balances.png", "Settle clearly", "Penalty balances show who owes what after missed goals.", COLORS["danger"], draw_balances),
    ("07-group-chat.png", "Keep momentum", "Chat, nudge, and comment when the group needs a push.", COLORS["primary"], draw_chat),
    ("08-profile.png", "Ready to settle", "Add profile and payment details for smoother group settlement.", COLORS["success"], draw_profile),
]


def draw_screenshots() -> None:
    for filename, title, subtitle, accent, renderer in SCREEN_DEFS:
        img = phone_base(title, subtitle, accent)
        d, shell = draw_phone_shell(img)
        renderer(d, shell)
        img.convert("RGB").save(SCREEN_OUT / filename, optimize=True)


def write_listing() -> None:
    full_description = """Do It Mate! helps friends turn intentions into real accountability.

Create a group, set a shared goal, choose the stakes, and keep everyone honest with photo proof. When someone misses the mark, the app records the penalty balance so the group can settle up clearly.

What you can do:
- Create private accountability groups
- Add positive goals and bad-habit trackers
- Require photo proof for completions
- Log slip-ups and penalty balances
- Compare progress on the leaderboard
- Review activity, comments, and proof photos
- Chat with your group and send nudges
- Add payment links for easier settlement

Built for fitness challenges, study goals, habit tracking, no-sugar pacts, early mornings, reading streaks, and any goal that works better with friends watching.

Do It Mate! does not process payments. It helps groups track accountability commitments, balances, and settlement status between members.
"""
    listing = {
        "app_name": "Do It Mate!",
        "short_description": "Group accountability with goals, photo proof, and penalty tracking",
        "full_description": full_description,
        "asset_alt_text": {
            "app_icon": "Do It Mate app icon with a checkmark target and group accountability symbols.",
            "feature_graphic": "Do It Mate feature graphic showing group accountability goals, proof, and penalty tracking.",
            "screenshots": {
                item[0]: item[1] + ": " + item[2] for item in SCREEN_DEFS
            },
        },
    }
    (OUT / "listing-copy.json").write_text(json.dumps(listing, indent=2), encoding="utf-8")
    (OUT / "listing-copy.md").write_text(
        f"""# Google Play Listing - Do It Mate!

## App Name
Do It Mate!

## Short Description
Group accountability with goals, photo proof, and penalty tracking

## Full Description
{full_description}
## Recommended Upload Order
1. App icon: `app-icon-512.png`
2. Feature graphic: `feature-graphic-1024x500.png`
3. Phone screenshots, in order: `phone-screenshots/01-home-dashboard.png` through `phone-screenshots/08-profile.png`

## Alt Text
- App icon: {listing["asset_alt_text"]["app_icon"]}
- Feature graphic: {listing["asset_alt_text"]["feature_graphic"]}
""",
        encoding="utf-8",
    )


def ensure_dirs() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SCREEN_OUT.mkdir(parents=True, exist_ok=True)


def main() -> None:
    ensure_dirs()
    draw_icon()
    draw_feature()
    draw_screenshots()
    write_listing()


if __name__ == "__main__":
    main()
