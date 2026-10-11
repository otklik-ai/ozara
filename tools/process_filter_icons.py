import os
from PIL import Image
import numpy as np

icon_mapping = {
    'filter_country.png': '/Users/bikram6am/.gemini/antigravity-ide/brain/e937d090-7538-4833-bb53-358d42566df1/filter_country_3d_1791739757358.jpg',
    'filter_city.png': '/Users/bikram6am/.gemini/antigravity-ide/brain/e937d090-7538-4833-bb53-358d42566df1/filter_city_3d_1791739774649.jpg',
    'filter_budget.png': '/Users/bikram6am/.gemini/antigravity-ide/brain/e937d090-7538-4833-bb53-358d42566df1/filter_budget_3d_1791739739592.jpg',
    'filter_bedrooms.png': '/Users/bikram6am/.gemini/antigravity-ide/brain/e937d090-7538-4833-bb53-358d42566df1/filter_bedrooms_3d_1791739792126.jpg',
    'filter_features.png': '/Users/bikram6am/.gemini/antigravity-ide/brain/e937d090-7538-4833-bb53-358d42566df1/filter_features_3d_1791739810086.jpg',
    'filter_sort.png': '/Users/bikram6am/.gemini/antigravity-ide/brain/e937d090-7538-4833-bb53-358d42566df1/filter_sort_bars_3d_1791740523163.jpg'
}

dest_dir = '/Users/bikram6am/Sila/public/investments/icons'
mobile_dir = '/Users/bikram6am/Sila/mobile/assets/investments'
os.makedirs(dest_dir, exist_ok=True)
os.makedirs(mobile_dir, exist_ok=True)

def remove_white_bg(img_path, out_path, size=(180, 180)):
    im = Image.open(img_path).convert('RGBA')
    arr = np.array(im, dtype=np.float32)
    
    r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
    
    # Calculate distance from white (255, 255, 255)
    diff = 255.0 - np.minimum(np.minimum(r, g), b)
    
    # Soft alpha mapping
    alpha = np.clip(diff / 25.0 * 255.0, 0, 255)
    
    # For very bright near-white edges, de-contaminate white fringe
    mask = alpha > 0
    # Desaturate fringe / restore color
    factor = np.where(alpha > 0, 255.0 / np.maximum(alpha, 1.0), 1.0)
    factor = np.clip(factor, 1.0, 1.3)
    
    arr[:,:,3] = alpha
    
    result = Image.fromarray(arr.astype(np.uint8), mode='RGBA')
    
    # Crop to non-transparent bounding box with padding
    bbox = result.getbbox()
    if bbox:
        # add 5% padding
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        pad = int(max(w, h) * 0.05)
        crop_box = (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(result.width, bbox[2] + pad),
            min(result.height, bbox[3] + pad)
        )
        result = result.crop(crop_box)
    
    # Make square canvas
    max_dim = max(result.width, result.height)
    square_im = Image.new('RGBA', (max_dim, max_dim), (0, 0, 0, 0))
    offset = ((max_dim - result.width) // 2, (max_dim - result.height) // 2)
    square_im.paste(result, offset)
    
    # Resize with high quality Lanczos filter
    final_im = square_im.resize(size, Image.Resampling.LANCZOS)
    final_im.save(out_path, format='PNG', optimize=True)
    print(f"Processed: {out_path} ({final_im.size})")

for name, src in icon_mapping.items():
    out = os.path.join(dest_dir, name)
    remove_white_bg(src, out)
    mobile_out = os.path.join(mobile_dir, name)
    remove_white_bg(src, mobile_out)

# Process 3D translucent glass neon contour arrows with diamond star sparkle (NO floor shade/reflection)
import math
from PIL import ImageDraw, ImageFilter, ImageOps

def create_glass_sparkle_arrow(is_left=True):
    W, H = 400, 400
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    
    def fillet_points():
        anchors = [
            (175, 95),   # 0: top fin
            (70, 200),   # 1: tip
            (175, 305),  # 2: bottom fin
            (175, 255),  # 3: bottom neck
            (330, 255),  # 4: bottom right
            (330, 145),  # 5: top right
            (175, 145)   # 6: top neck
        ]
        radii = [18, 22, 18, 14, 18, 18, 14]
        dense_pts = []
        n = len(anchors)
        for i in range(n):
            p_prev = anchors[(i - 1) % n]
            p_curr = anchors[i]
            p_next = anchors[(i + 1) % n]
            v1 = (p_prev[0] - p_curr[0], p_prev[1] - p_curr[1])
            v2 = (p_next[0] - p_curr[0], p_next[1] - p_curr[1])
            l1 = math.hypot(*v1)
            l2 = math.hypot(*v2)
            u1 = (v1[0]/l1, v1[1]/l1)
            u2 = (v2[0]/l2, v2[1]/l2)
            r = min(radii[i], l1*0.4, l2*0.4)
            p_start = (p_curr[0] + u1[0]*r, p_curr[1] + u1[1]*r)
            p_end = (p_curr[0] + u2[0]*r, p_curr[1] + u2[1]*r)
            for t in np.linspace(0, 1, 10):
                bx = (1-t)**2 * p_start[0] + 2*(1-t)*t * p_curr[0] + t**2 * p_end[0]
                by = (1-t)**2 * p_start[1] + 2*(1-t)*t * p_curr[1] + t**2 * p_end[1]
                dense_pts.append((bx, by))
        return dense_pts

    pts = fillet_points()
    
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d_glow = ImageDraw.Draw(glow)
    d_glow.polygon(pts, outline=(0, 229, 255, 120), width=16)
    glow = glow.filter(ImageFilter.GaussianBlur(7))
    
    tube = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d_tube = ImageDraw.Draw(tube)
    d_tube.polygon(pts, fill=(0, 240, 255, 20), outline=(0, 220, 250, 210), width=11)
    
    rim = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d_rim = ImageDraw.Draw(rim)
    d_rim.polygon(pts, outline=(255, 255, 255, 230), width=3)
    rim = rim.filter(ImageFilter.GaussianBlur(1))
    
    base = Image.alpha_composite(glow, tube)
    base = Image.alpha_composite(base, rim)
    
    # Delicate 4-pointed luxury diamond sparkle at the top fin
    sp = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d_sp = ImageDraw.Draw(sp)
    cx, cy, r = 175, 95, 22
    ir = r * 0.16
    star_pts = [
        (cx, cy - r), (cx + ir, cy - ir), (cx + r, cy), (cx + ir, cy + ir),
        (cx, cy + r), (cx - ir, cy + ir), (cx - r, cy), (cx - ir, cy - ir)
    ]
    d_sp.polygon(star_pts, fill=(255, 255, 255, 255))
    d_sp.ellipse([cx-ir*1.2, cy-ir*1.2, cx+ir*1.2, cy+ir*1.2], fill=(255, 255, 255, 255))
    sp_glow = sp.filter(ImageFilter.GaussianBlur(3))
    
    final_arrow = Image.alpha_composite(base, sp_glow)
    final_arrow = Image.alpha_composite(final_arrow, sp)
    
    if not is_left:
        final_arrow = ImageOps.mirror(final_arrow)
        
    return final_arrow.resize((180, 180), Image.Resampling.LANCZOS)

left_arrow = create_glass_sparkle_arrow(is_left=True)
right_arrow = create_glass_sparkle_arrow(is_left=False)

left_arrow.save(os.path.join(dest_dir, 'arrow_left_glass.png'), optimize=True)
right_arrow.save(os.path.join(dest_dir, 'arrow_right_glass.png'), optimize=True)
left_arrow.save(os.path.join(mobile_dir, 'arrow_left_glass.png'), optimize=True)
right_arrow.save(os.path.join(mobile_dir, 'arrow_right_glass.png'), optimize=True)

print("All filter and glass sparkle arrow icons successfully generated and saved!")
