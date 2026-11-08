from PIL import Image
from pathlib import Path

src = Image.open("master.png").convert("RGB")   # RGB = no transparency (iPhones paint transparent areas black)
Path("icons").mkdir(exist_ok=True)

sizes = {
    "icon-512.png": 512,
    "icon-192.png": 192,
    "icon-maskable-512.png": 512,   # same art: it already has safe margins
    "apple-touch-icon.png": 180,
    "favicon-32.png": 32,
    "favicon-48.png": 48,
}
for name, size in sizes.items():
    src.resize((size, size), Image.LANCZOS).save(f"icons/{name}")
    print("made", name)