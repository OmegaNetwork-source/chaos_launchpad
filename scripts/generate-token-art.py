#!/usr/bin/env python3
"""
Generate unique procedural token art images for missing slugs.
Each slug gets a unique color scheme and pattern based on its name hash.
"""

import os
import hashlib
import math
from PIL import Image, ImageDraw

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'web', 'public', 'token-art')
SIZE = 512

REQUIRED_SLUGS = [
    'axo', 'blob', 'blorb', 'bnna', 'bongo', 'bonk', 'bounce', 'chick', 'chili',
    'chonk', 'clown', 'crisp', 'crumb', 'derp', 'disco', 'doodle', 'fizzy', 'glorp',
    'gobln', 'goose', 'grump', 'gum', 'king', 'melt', 'moth', 'muffin', 'nibble',
    'nood', 'nug', 'party', 'peach', 'pfrog', 'pickle', 'pixel', 'plonk', 'puff',
    'quack', 'rizz', 'salty', 'sigma', 'sloth', 'snork', 'sploosh', 'tato', 'trash',
    'turbo', 'waff', 'wiggle', 'wojak', 'yeet', 'zigzag', 'zoom', 'zorp'
]

def slug_hash(slug: str) -> int:
    return int(hashlib.md5(slug.encode()).hexdigest(), 16)

def hash_to_color(h: int, offset: int = 0) -> tuple:
    """Generate a vibrant color from hash."""
    hue = ((h >> offset) % 360) / 360.0
    sat = 0.7 + ((h >> (offset + 8)) % 30) / 100.0
    val = 0.8 + ((h >> (offset + 16)) % 20) / 100.0
    return hsv_to_rgb(hue, sat, val)

def hsv_to_rgb(h: float, s: float, v: float) -> tuple:
    if s == 0.0:
        return (int(v * 255), int(v * 255), int(v * 255))
    i = int(h * 6.0)
    f = (h * 6.0) - i
    p = v * (1.0 - s)
    q = v * (1.0 - s * f)
    t = v * (1.0 - s * (1.0 - f))
    i = i % 6
    if i == 0: r, g, b = v, t, p
    elif i == 1: r, g, b = q, v, p
    elif i == 2: r, g, b = p, v, t
    elif i == 3: r, g, b = p, q, v
    elif i == 4: r, g, b = t, p, v
    else: r, g, b = v, p, q
    return (int(r * 255), int(g * 255), int(b * 255))

def draw_circles(draw, h, size, color1, color2):
    """Pattern: overlapping circles."""
    num = 5 + (h % 8)
    for i in range(num):
        cx = (h >> (i * 3)) % size
        cy = (h >> (i * 3 + 12)) % size
        r = 40 + (h >> (i * 2 + 20)) % 120
        c = color1 if i % 2 == 0 else color2
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)

def draw_stripes(draw, h, size, color1, color2):
    """Pattern: diagonal stripes."""
    stripe_w = 20 + (h % 40)
    angle = (h % 180)
    for i in range(-size, size * 2, stripe_w):
        c = color1 if (i // stripe_w) % 2 == 0 else color2
        if angle < 90:
            draw.polygon([(i, 0), (i + stripe_w, 0), (i + stripe_w + size, size), (i + size, size)], fill=c)
        else:
            draw.polygon([(i, size), (i + stripe_w, size), (i + stripe_w - size, 0), (i - size, 0)], fill=c)

def draw_grid(draw, h, size, color1, color2, color3):
    """Pattern: colorful grid."""
    cell = 40 + (h % 60)
    for y in range(0, size, cell):
        for x in range(0, size, cell):
            idx = ((x // cell) + (y // cell) * 7 + h) % 3
            c = [color1, color2, color3][idx]
            draw.rectangle([x, y, x + cell - 2, y + cell - 2], fill=c)

def draw_waves(draw, h, size, color1, color2):
    """Pattern: wavy lines."""
    amp = 20 + (h % 40)
    freq = 0.02 + (h % 10) / 500.0
    phase = (h % 100) / 10.0
    for y in range(0, size, 30):
        points = []
        for x in range(0, size + 10, 5):
            yy = y + int(amp * math.sin(freq * x + phase + y / 50.0))
            points.append((x, yy))
        for x in range(size, -10, -5):
            yy = y + 25 + int(amp * math.sin(freq * x + phase + y / 50.0))
            points.append((x, yy))
        c = color1 if (y // 30) % 2 == 0 else color2
        if len(points) >= 3:
            draw.polygon(points, fill=c)

def draw_diamonds(draw, h, size, color1, color2, color3):
    """Pattern: diamond shapes."""
    cell = 60 + (h % 50)
    for y in range(-cell, size + cell, cell):
        for x in range(-cell, size + cell, cell):
            offset = cell // 2 if (y // cell) % 2 == 1 else 0
            cx, cy = x + offset, y
            idx = ((x + y + h) // cell) % 3
            c = [color1, color2, color3][idx]
            half = cell // 2 - 3
            draw.polygon([(cx, cy - half), (cx + half, cy), (cx, cy + half), (cx - half, cy)], fill=c)

def draw_bubbles(draw, h, size, color1, color2, bg):
    """Pattern: bubble circles with outlines."""
    num = 8 + (h % 12)
    for i in range(num):
        cx = (h >> (i * 5)) % size
        cy = (h >> (i * 5 + 16)) % size
        r = 30 + (h >> (i * 3 + 10)) % 80
        c = color1 if i % 2 == 0 else color2
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c, outline=bg, width=4)

def draw_triangles(draw, h, size, color1, color2, color3):
    """Pattern: triangular tessellation."""
    cell = 70 + (h % 50)
    for y in range(-cell, size + cell, cell):
        for x in range(-cell, size + cell * 2, cell):
            offset = cell // 2 if (y // cell) % 2 == 1 else 0
            x1, y1 = x + offset, y
            idx = ((x + y + h) // cell) % 3
            c = [color1, color2, color3][idx]
            # Up triangle
            draw.polygon([(x1, y1), (x1 + cell // 2, y1 + cell), (x1 - cell // 2, y1 + cell)], fill=c)
            # Down triangle
            c2 = [color2, color3, color1][idx]
            draw.polygon([(x1, y1 + cell), (x1 + cell // 2, y1), (x1 + cell, y1 + cell)], fill=c2)

def generate_image(slug: str) -> Image.Image:
    """Generate a unique image for the given slug."""
    h = slug_hash(slug)
    
    # Generate colors
    bg = hash_to_color(h, 0)
    c1 = hash_to_color(h, 24)
    c2 = hash_to_color(h, 48)
    c3 = hash_to_color(h, 72)
    
    # Create image
    img = Image.new('RGB', (SIZE, SIZE), bg)
    draw = ImageDraw.Draw(img)
    
    # Pick pattern based on hash
    pattern = h % 7
    if pattern == 0:
        draw_circles(draw, h, SIZE, c1, c2)
    elif pattern == 1:
        draw_stripes(draw, h, SIZE, c1, c2)
    elif pattern == 2:
        draw_grid(draw, h, SIZE, c1, c2, c3)
    elif pattern == 3:
        draw_waves(draw, h, SIZE, c1, c2)
    elif pattern == 4:
        draw_diamonds(draw, h, SIZE, c1, c2, c3)
    elif pattern == 5:
        draw_bubbles(draw, h, SIZE, c1, c2, bg)
    else:
        draw_triangles(draw, h, SIZE, c1, c2, c3)
    
    return img

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    added = []
    skipped = []
    
    for slug in REQUIRED_SLUGS:
        filepath = os.path.join(OUTPUT_DIR, f'{slug}.jpg')
        if os.path.exists(filepath):
            skipped.append(slug)
            continue
        
        img = generate_image(slug)
        img.save(filepath, 'JPEG', quality=90)
        added.append(slug)
        print(f'Created: {slug}.jpg')
    
    print(f'\nAdded: {len(added)} files')
    print(f'Skipped (already exist): {len(skipped)} files')
    
    if added:
        print('\nNew files:')
        for s in added:
            print(f'  {s}.jpg')

if __name__ == '__main__':
    main()
