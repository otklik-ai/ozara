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

# Process 3D translucent glass neon contour arrows
from PIL import ImageOps
src_arrow = '/Users/bikram6am/.gemini/antigravity-ide/brain/e937d090-7538-4833-bb53-358d42566df1/arrow_left_glass_neon_1791741342305.jpg'
if os.path.exists(src_arrow):
    im_left = Image.open(src_arrow).convert('RGBA')
    im_right = ImageOps.mirror(im_left)

    def process_clean_arrow(img, out_name):
        arr = np.array(img, dtype=np.float32)
        r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
        max_c = np.maximum(np.maximum(r, g), b)
        min_c = np.minimum(np.minimum(r, g), b)
        chroma = max_c - min_c
        darkness = 255.0 - ((r + g + b) / 3.0)
        tube_weight = np.clip((chroma - 8.0) / 15.0, 0, 1)
        dark_weight = np.clip((darkness - 15.0) / 25.0, 0, 1)
        strength = np.maximum(tube_weight, dark_weight)
        alpha = np.clip(strength * 255.0, 0, 255)
        arr[:,:,3] = alpha
        result = Image.fromarray(arr.astype(np.uint8), mode='RGBA')
        bbox = result.getbbox()
        if bbox:
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            pad = int(max(w, h) * 0.03)
            crop_box = (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(result.width, bbox[2] + pad),
                min(result.height, bbox[3] + pad)
            )
            result = result.crop(crop_box)
        target_size = (180, 180)
        max_dim = max(result.width, result.height)
        square_im = Image.new('RGBA', (max_dim, max_dim), (0, 0, 0, 0))
        offset = ((max_dim - result.width) // 2, (max_dim - result.height) // 2)
        square_im.paste(result, offset)
        final_im = square_im.resize(target_size, Image.Resampling.LANCZOS)
        final_im.save(os.path.join(dest_dir, out_name), format='PNG', optimize=True)
        final_im.save(os.path.join(mobile_dir, out_name), format='PNG', optimize=True)
        print(f"Processed: {out_name}")

    process_clean_arrow(im_left, 'arrow_left_glass.png')
    process_clean_arrow(im_right, 'arrow_right_glass.png')

print("All filter and arrow icons successfully generated and saved!")
