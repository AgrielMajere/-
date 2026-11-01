import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; files = sys.argv[3:]
ims = [(f, Image.open(os.path.join(d, f + '.png')).crop((0, 0, 720, 480)).resize((360, 240))) for f in files if os.path.exists(os.path.join(d, f + '.png'))]
cols = 3; rows = (len(ims) + cols - 1)//cols
S = Image.new('RGB', (cols*360, rows*240), 'white'); D = ImageDraw.Draw(S)
for i, (f, im) in enumerate(ims):
    x, y = (i % cols)*360, (i//cols)*240; S.paste(im, (x, y)); D.rectangle([x, y, x + 150, y + 16], fill='black'); D.text((x + 3, y + 2), f, fill='yellow')
S.save(out)
