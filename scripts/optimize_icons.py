from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/webdev-static-assets/tabibi-app-icon.png')
targets = [
    Path('/home/ubuntu/tabibi-mobile/assets/images/icon.png'),
    Path('/home/ubuntu/tabibi-mobile/assets/images/splash-icon.png'),
    Path('/home/ubuntu/tabibi-mobile/assets/images/favicon.png'),
    Path('/home/ubuntu/tabibi-mobile/assets/images/android-icon-foreground.png'),
]

with Image.open(source) as image:
    optimized = image.convert('RGBA')
    optimized.thumbnail((768, 768), Image.Resampling.LANCZOS)
    for target in targets:
        optimized.save(target, format='PNG', optimize=True, compress_level=9)
