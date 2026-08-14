from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/upload/64a743a0-968b-11f1-ba21-2d714c99130c.png')
assets = Path('/home/ubuntu/tabibi-mobile/assets/images')

with Image.open(source) as source_image:
    image = source_image.convert('RGBA')
    mark = image.crop((310, 70, 1570, 1040))
    mark.resize((720, 554), Image.Resampling.LANCZOS).save(assets / 'tabibi-mark.png', 'PNG', optimize=True, compress_level=9)
    image.crop((290, 50, 1630, 1850)).resize((860, 1155), Image.Resampling.LANCZOS).save(assets / 'tabibi-brand.png', 'PNG', optimize=True, compress_level=9)
    app_icon = mark.resize((720, 554), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (768, 768), '#F5F0E6')
    canvas.alpha_composite(app_icon, (24, 107))
    for name in ['icon.png', 'splash-icon.png', 'favicon.png', 'android-icon-foreground.png']:
        canvas.save(assets / name, 'PNG', optimize=True, compress_level=9)
