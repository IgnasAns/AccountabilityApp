from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ICON = ROOT / "assets" / "google-play" / "app-icon-512.png"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = Path(r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf")
    if path.exists():
        return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def fit_icon(size: int, scale: float = 1.0) -> Image.Image:
    src = Image.open(ICON).convert("RGBA")
    side = int(size * scale)
    src = src.resize((side, side), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(src, ((size - side) // 2, (size - side) // 2))
    return out


def round_icon(size: int) -> Image.Image:
    src = fit_icon(size)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(src)
    out.putalpha(mask)
    return out


def splash() -> Image.Image:
    size = 1024
    img = Image.new("RGBA", (size, size), (10, 10, 10, 255))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((110, 100, 914, 904), fill=(59, 130, 246, 92))
    gd.ellipse((230, 320, 794, 884), fill=(74, 222, 128, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img.alpha_composite(glow)

    icon = round_icon(470)
    img.alpha_composite(icon, (277, 210))
    d = ImageDraw.Draw(img)
    d.text((512, 742), "Do It Mate!", font=font(72, True), fill=(255, 255, 255), anchor="mm")
    d.text((512, 820), "Goals need proof.", font=font(34, True), fill=(74, 222, 128), anchor="mm")
    return img


def save_sources() -> None:
    icon = Image.open(ICON).convert("RGBA")
    icon.save(ROOT / "assets" / "icon.png", optimize=True)
    icon.resize((1024, 1024), Image.Resampling.LANCZOS).save(ROOT / "assets" / "favicon.png", optimize=True)
    fit_icon(1024, 0.78).save(ROOT / "assets" / "adaptive-icon.png", optimize=True)
    splash().save(ROOT / "assets" / "splash.png", optimize=True)


def save_android_resources() -> None:
    sizes = {
        "mipmap-mdpi": 108,
        "mipmap-hdpi": 162,
        "mipmap-xhdpi": 216,
        "mipmap-xxhdpi": 324,
        "mipmap-xxxhdpi": 432,
    }
    res = ROOT / "android" / "app" / "src" / "main" / "res"
    for folder, size in sizes.items():
        base = res / folder
        fit_icon(size).save(base / "ic_launcher.png", optimize=True)
        fit_icon(size, 0.78).save(base / "ic_launcher_foreground.png", optimize=True)
        round_icon(size).save(base / "ic_launcher_round.png", optimize=True)

    splash_img = splash()
    for folder in [
        "drawable-mdpi",
        "drawable-hdpi",
        "drawable-xhdpi",
        "drawable-xxhdpi",
        "drawable-xxxhdpi",
    ]:
        splash_img.save(res / folder / "splashscreen_image.png", optimize=True)


def main() -> None:
    save_sources()
    save_android_resources()


if __name__ == "__main__":
    main()
