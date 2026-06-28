#!/usr/bin/env python3
"""
Perceptual Hash Utilities
"""

import imagehash
from PIL import Image
from typing import Dict

def generate_phash(image: Image.Image) -> Dict[str, str]:
    """
    Generate multiple perceptual hashes for duplicate detection
    
    Returns:
        dict with 'phash', 'dhash', 'whash'
    """
    try:
        return {
            "phash": str(imagehash.phash(image)),
            "dhash": str(imagehash.dhash(image)),
            "whash": str(imagehash.whash(image))
        }
    except Exception as e:
        print(f"[WARN] Error generating perceptual hash: {e}")
        return {
            "phash": "",
            "dhash": "",
            "whash": ""
        }

