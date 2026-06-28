#!/usr/bin/env python3
"""
Image Processing Utilities
"""

import os
import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Dict, Tuple
from PIL import Image
import imagehash
import exifread

def load_image(image_path: str) -> Optional[Image.Image]:
    """Load image with error handling"""
    try:
        img = Image.open(image_path)
        # Convert to RGB if necessary
        if img.mode != 'RGB':
            img = img.convert('RGB')
        return img
    except Exception as e:
        print(f"[WARN] Error loading image {image_path}: {e}")
        return None


def load_image_cv2(image_path: str) -> Optional[np.ndarray]:
    """Load image as OpenCV BGR array"""
    try:
        img = cv2.imread(image_path)
        if img is None:
            return None
        return img
    except Exception as e:
        print(f"[WARN] Error loading image with OpenCV {image_path}: {e}")
        return None


def convert_to_webp(image_path: str, output_dir: str = "/data/webp", quality: int = 90) -> Optional[str]:
    """
    Convert image to WebP format
    Returns path to WebP file if conversion successful and smaller, else None
    """
    try:
        img = load_image(image_path)
        if img is None:
            return None
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate output path
        base_name = Path(image_path).stem
        webp_path = os.path.join(output_dir, f"{base_name}.webp")
        
        # Save as WebP
        img.save(webp_path, "WEBP", quality=quality, method=6)
        
        # Check if WebP is smaller
        original_size = os.path.getsize(image_path)
        webp_size = os.path.getsize(webp_path)
        
        if webp_size < original_size:
            return webp_path
        else:
            # WebP is larger, delete it and keep original
            os.remove(webp_path)
            return None
            
    except Exception as e:
        print(f"[WARN] Error converting to WebP: {e}")
        return None


def generate_thumbnail(image: Image.Image, output_dir: str = "/data/thumbnails", size: Tuple[int, int] = (200, 200)) -> Optional[str]:
    """Generate thumbnail"""
    try:
        os.makedirs(output_dir, exist_ok=True)
        
        # Create thumbnail
        thumb = image.copy()
        thumb.thumbnail(size, Image.Resampling.LANCZOS)
        
        # Convert RGBA to RGB (JPEG doesn't support transparency)
        if thumb.mode == 'RGBA':
            background = Image.new('RGB', thumb.size, (255, 255, 255))
            background.paste(thumb, mask=thumb.split()[3])
            thumb = background
        elif thumb.mode != 'RGB':
            thumb = thumb.convert('RGB')
        
        # Save
        thumb_name = f"thumb_{id(image)}_{size[0]}x{size[1]}.jpg"
        thumb_path = os.path.join(output_dir, thumb_name)
        thumb.save(thumb_path, "JPEG", quality=85)
        
        return thumb_path
        
    except Exception as e:
        print(f"[WARN] Error generating thumbnail: {e}")
        return None


def extract_metadata(image: Image.Image, image_path: str) -> Dict:
    """Extract comprehensive image metadata"""
    metadata = {
        "width": image.width,
        "height": image.height,
        "format": image.format or "unknown",
        "mode": image.mode,
        "file_size": os.path.getsize(image_path),
        "has_transparency": image.mode in ("RGBA", "LA", "P")
    }
    
    # EXIF data
    try:
        exif_data = image._getexif()
        if exif_data:
            exif_dict = {}
            for tag_id, value in exif_data.items():
                tag = Image.ExifTags.TAGS.get(tag_id, tag_id)
                exif_dict[tag] = str(value)
            metadata["exif"] = exif_dict
    except:
        pass
    
    # EXIF forensics (using exifread for more details)
    try:
        with open(image_path, 'rb') as f:
            tags = exifread.process_file(f)
            exif_forensics = {}
            for tag in tags.keys():
                if tag not in ('JPEGThumbnail', 'TIFFThumbnail', 'Filename', 'EXIF MakerNote'):
                    exif_forensics[tag] = str(tags[tag])
            if exif_forensics:
                metadata["exif_forensics"] = exif_forensics
    except:
        pass
    
    return metadata


def extract_objects_yolo(image_path: str, yolo_model) -> list:
    """Detect objects using YOLO model"""
    if yolo_model is None:
        return []
    
    try:
        from ultralytics import YOLO
        results = yolo_model(image_path, verbose=False)
        objects = []
        
        for result in results:
            for box in result.boxes:
                objects.append({
                    "class": yolo_model.names[int(box.cls)],
                    "confidence": float(box.conf),
                    "bbox": box.xyxy[0].tolist()
                })
        
        return objects
    except Exception as e:
        print(f"[WARN] Object detection failed: {e}")
        return []


def extract_text_easyocr(image_path: str, easyocr_reader) -> str:
    """Extract text using EasyOCR"""
    if easyocr_reader is None:
        return ""
    
    try:
        results = easyocr_reader.readtext(image_path)
        text = " ".join([result[1] for result in results])
        return text.strip()
    except Exception as e:
        print(f"[WARN] EasyOCR failed: {e}")
        return ""


def extract_text_tesseract(image: Image.Image) -> str:
    """Extract text using Tesseract (fallback)"""
    try:
        import pytesseract
        return pytesseract.image_to_string(image, lang='eng').strip()
    except:
        return ""

