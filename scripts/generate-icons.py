#!/usr/bin/env python3
"""Rasterises public/icons/icon.svg into the PNG sizes the manifest asks for.

Kept as a script rather than a build step because the icons change roughly never
and committing them keeps the build free of an image toolchain. Run it if the
mark changes:

    python3 scripts/generate-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

GROUND = "#0A0A0A"
MARK = "#FFFFFF"
CANVAS = 512
SUPERSAMPLE = 4

# The barbell from icon.svg, in that file's 512-unit coordinate space:
# (x, y, width, height, corner radius).
BARS = [
    (96, 240, 320, 32, 0),
    (64, 200, 32, 112, 8),
    (416, 200, 32, 112, 8),
    (112, 168, 48, 176, 12),
    (352, 168, 48, 176, 12),
    (176, 200, 36, 112, 10),
    (300, 200, 36, 112, 10),
]

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"


def render(size: int, mark_scale: float = 1.0) -> Image.Image:
    """Draws the mark at `size`, with the barbell scaled about the centre.

    `mark_scale` below 1 leaves the padding a maskable icon needs: Android crops
    to a circle inscribed in the middle 80%, so a full-bleed barbell loses its
    outer plates.
    """
    canvas = size * SUPERSAMPLE
    image = Image.new("RGB", (canvas, canvas), GROUND)
    draw = ImageDraw.Draw(image)
    unit = canvas / CANVAS
    centre = CANVAS / 2

    for x, y, width, height, radius in BARS:
        box = [
            (centre + (x - centre) * mark_scale) * unit,
            (centre + (y - centre) * mark_scale) * unit,
            (centre + (x + width - centre) * mark_scale) * unit,
            (centre + (y + height - centre) * mark_scale) * unit,
        ]
        if radius:
            draw.rounded_rectangle(box, radius=radius * mark_scale * unit, fill=MARK)
        else:
            draw.rectangle(box, fill=MARK)

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    render(192).save(OUT / "icon-192.png")
    render(512).save(OUT / "icon-512.png")
    render(512, mark_scale=0.7).save(OUT / "icon-maskable-512.png")
    render(180).save(OUT / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
