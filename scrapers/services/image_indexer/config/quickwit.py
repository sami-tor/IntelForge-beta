#!/usr/bin/env python3
"""
Quickwit Configuration and Index Setup
"""

import os
import json
import urllib.request
from typing import Optional, Dict, Any

QUICKWIT_URL = os.getenv("QUICKWIT_URL", "http://localhost:7280")
IMAGE_METADATA_INDEX = os.getenv("QUICKWIT_IMAGE_INDEX", "image_metadata")


def get_quickwit_index_config() -> Dict[str, Any]:
    """Get Quickwit index configuration for image_metadata"""
    return {
        "version": "0.8",
        "index_id": IMAGE_METADATA_INDEX,
        "doc_mapping": {
            "mode": "lenient",
            "field_mappings": [
                {
                    "name": "image_id",
                    "type": "text",
                    "tokenizer": "raw",
                    "indexed": True,
                    "stored": True
                },
                {
                    "name": "file_path",
                    "type": "text",
                    "tokenizer": "raw",
                    "indexed": True,
                    "stored": True
                },
                {
                    "name": "ocr_text",
                    "type": "text",
                    "tokenizer": "default",
                    "indexed": True,
                    "stored": True,
                    "fast": True
                },
                {
                    "name": "objects",
                    "type": "array<text>",
                    "tokenizer": "default",
                    "indexed": True,
                    "stored": True
                },
                {
                    "name": "phash",
                    "type": "text",
                    "tokenizer": "raw",
                    "indexed": True,
                    "stored": True
                },
                {
                    "name": "faces_count",
                    "type": "u64",
                    "indexed": True,
                    "stored": True
                },
                {
                    "name": "width",
                    "type": "u64",
                    "indexed": True,
                    "stored": True
                },
                {
                    "name": "height",
                    "type": "u64",
                    "indexed": True,
                    "stored": True
                },
                {
                    "name": "format",
                    "type": "text",
                    "tokenizer": "raw",
                    "indexed": True,
                    "stored": True
                },
                {
                    "name": "timestamp",
                    "type": "datetime",
                    "input_formats": ["unix_timestamp"],
                    "indexed": True,
                    "stored": True,
                    "fast": True
                }
            ],
            "timestamp_field": "timestamp"
        },
        "indexing_settings": {
            "commit_timeout_secs": 60
        },
        "search_settings": {
            "default_search_fields": ["ocr_text", "objects"]
        }
    }


def ensure_quickwit_index() -> bool:
    """Create Quickwit index if it doesn't exist"""
    try:
        # Check if index exists
        check_url = f"{QUICKWIT_URL}/api/v1/indexes/{IMAGE_METADATA_INDEX}"
        try:
            req = urllib.request.Request(check_url, method="GET")
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.getcode() == 200:
                    print(f"[OK] Quickwit index '{IMAGE_METADATA_INDEX}' already exists")
                    return True
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
        
        # Create index
        config = get_quickwit_index_config()
        create_url = f"{QUICKWIT_URL}/api/v1/indexes"
        
        req = urllib.request.Request(
            create_url,
            data=json.dumps(config).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            if response.getcode() in (200, 201):
                print(f"[OK] Created Quickwit index '{IMAGE_METADATA_INDEX}'")
                return True
            else:
                error_text = response.read().decode('utf-8')
                print(f"[ERROR] Failed to create index: {error_text}")
                return False
                
    except Exception as e:
        print(f"[ERROR] Error ensuring Quickwit index: {e}")
        import traceback
        traceback.print_exc()
        return False


def index_document(doc: Dict[str, Any]) -> bool:
    """Index a single document to Quickwit"""
    try:
        ingest_url = f"{QUICKWIT_URL}/api/v1/{IMAGE_METADATA_INDEX}/ingest"
        
        # Ensure timestamp is set
        if "timestamp" not in doc:
            import time
            doc["timestamp"] = int(time.time())
        
        # Convert to NDJSON format
        doc_json = json.dumps(doc) + "\n"
        
        req = urllib.request.Request(
            ingest_url,
            data=doc_json.encode('utf-8'),
            headers={'Content-Type': 'application/x-ndjson'},
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.getcode() in (200, 201)
            
    except Exception as e:
        print(f"[WARN] Error indexing document to Quickwit: {e}")
        return False


def search_quickwit(query: str, filters: Optional[Dict[str, Any]] = None, limit: int = 100) -> list:
    """Search Quickwit index and return image_ids"""
    try:
        search_url = f"{QUICKWIT_URL}/api/v1/{IMAGE_METADATA_INDEX}/search"
        
        search_body = {
            "query": query,
            "max_hits": limit,
            "search_fields": ["ocr_text", "objects"]
        }
        
        if filters:
            # Build filter query
            filter_parts = []
            for key, value in filters.items():
                if isinstance(value, list):
                    filter_parts.append(f"{key}:({','.join(map(str, value))})")
                else:
                    filter_parts.append(f"{key}:{value}")
            
            if filter_parts:
                search_body["query"] = f"{query} AND {' AND '.join(filter_parts)}"
        
        req = urllib.request.Request(
            search_url,
            data=json.dumps(search_body).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            if response.getcode() == 200:
                result = json.loads(response.read().decode('utf-8'))
                # Extract image_ids from hits
                image_ids = []
                for hit in result.get("hits", []):
                    image_id = hit.get("image_id") or hit.get("_source", {}).get("image_id")
                    if image_id:
                        image_ids.append(image_id)
                return image_ids
        
        return []
        
    except Exception as e:
        print(f"[WARN] Error searching Quickwit: {e}")
        return []

