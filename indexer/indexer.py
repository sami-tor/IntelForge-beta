#!/usr/bin/env python3
"""
Intel Forge Quickwit Indexer
Fast indexing of OSINT data files into Quickwit
"""

import os
import json
import sys
from pathlib import Path
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from typing import Optional

# Configuration
QUICKWIT_URL = os.getenv("QUICKWIT_URL", "http://localhost:7280")
DATA_DIRECTORY = os.getenv("DATA_DIRECTORY", "./data")
INDEX_NAME = os.getenv("INDEX_NAME", "osint-data")
BATCH_SIZE = 1000  # Index in batches for better performance


def extract_country(file_path: str) -> str:
    """Extract country from file path like /data/countries/India/file.txt"""
    if "countries/" in file_path:
        parts = file_path.split("countries/")
        if len(parts) > 1:
            country = parts[1].split("/")[0]
            return country
    return "unknown"


def extract_category(file_path: str) -> str:
    try:
        normalized = file_path.replace("\\", "/")
        base = os.path.abspath(DATA_DIRECTORY).replace("\\", "/")
        if not base.endswith("/"):
            base += "/"
        if normalized.startswith(base):
            rel = normalized[len(base):]
        else:
            rel = os.path.relpath(file_path, DATA_DIRECTORY).replace("\\", "/")
        parts = [p for p in rel.split("/") if p and p not in (".", "..")]
        if len(parts) <= 1:
            return "uncategorized"
        top = parts[0].lower()
        if top == "scraped":
            if len(parts) >= 3 and parts[1].lower() == "forums":
                return "/".join([parts[0].lower(), parts[1].lower(), parts[2].lower()])
            if len(parts) >= 2:
                return "/".join([parts[0].lower(), parts[1].lower()])
            return "scraped"
        if top in ("leaks", "intel") and len(parts) >= 2:
            return "/".join([parts[0].lower(), parts[1].lower()])
        return top
    except Exception:
        return "uncategorized"


def get_file_type(file_name: str) -> str:
    """Get file extension"""
    ext = Path(file_name).suffix
    return ext[1:].lower() if ext else "txt"


def index_batch(docs: list, index_name: str) -> bool:
    """Index a batch of documents to Quickwit"""
    url = f"{QUICKWIT_URL}/api/v1/{index_name}/ingest"
    
    try:
        # Convert to NDJSON format (newline-delimited JSON)
        ndjson = "\n".join(json.dumps(doc) for doc in docs)
        ndjson_bytes = ndjson.encode('utf-8')
        
        req = Request(url, data=ndjson_bytes, headers={"Content-Type": "application/x-ndjson"}, method='POST')
        
        with urlopen(req, timeout=30) as response:
            status_code = response.getcode()
            if status_code in [200, 201]:
                return True
            else:
                response_text = response.read().decode('utf-8')
                print(f"Error indexing batch: {status_code} - {response_text}")
                return False
    except HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else str(e)
        print(f"HTTP Error indexing batch: {e.code} - {error_body}")
        return False
    except Exception as e:
        print(f"Exception indexing batch: {e}")
        return False


def index_files():
    """Main indexing function"""
    print(f"Starting Quickwit indexer...")
    print(f"Quickwit URL: {QUICKWIT_URL}")
    print(f"Data Directory: {DATA_DIRECTORY}")
    print(f"Index Name: {INDEX_NAME}")
    print("-" * 50)
    
    # Check if data directory exists
    if not os.path.exists(DATA_DIRECTORY):
        print(f"Error: Data directory not found: {DATA_DIRECTORY}")
        sys.exit(1)
    
    # Check Quickwit connection
    try:
        health_url = f"{QUICKWIT_URL}/health"
        req = Request(health_url, method='GET')
        with urlopen(req, timeout=5) as response:
            if response.getcode() != 200:
                print(f"Warning: Quickwit health check failed: {response.getcode()}")
    except Exception as e:
        print(f"Warning: Could not connect to Quickwit: {e}")
        print("Make sure Quickwit is running and accessible")
    
    total_lines = 0
    total_files = 0
    batch = []
    errors = 0
    
    # Walk through data directory
    for root, dirs, files in os.walk(DATA_DIRECTORY):
        # Skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        
        for file_name in files:
            # Skip hidden files
            if file_name.startswith('.'):
                continue
            
            file_path = os.path.join(root, file_name)
            total_files += 1
            
            try:
                # Try to read file as text
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    for line_num, line in enumerate(f, 1):
                        line = line.strip()
                        if not line:  # Skip empty lines
                            continue
                        
                        total_lines += 1
                        
                        # Create document
                        doc = {
                            "timestamp": int(datetime.now().timestamp()),
                            "file_path": file_path.replace("\\", "/"),  # Normalize path
                            "file_name": file_name,
                            "line_number": line_num,
                            "content": line,
                            "file_type": get_file_type(file_name),
                            "country": extract_country(file_path),
                            "category": extract_category(file_path)
                        }
                        
                        batch.append(doc)
                        
                        # Index batch when it reaches BATCH_SIZE
                        if len(batch) >= BATCH_SIZE:
                            if index_batch(batch, INDEX_NAME):
                                print(f"✓ Indexed batch: {len(batch)} documents (Total: {total_lines} lines, {total_files} files)")
                            else:
                                errors += len(batch)
                            batch = []
                        
                        # Progress update every 10k lines
                        if total_lines % 10000 == 0:
                            print(f"Progress: {total_lines} lines from {total_files} files...")
                            
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
                errors += 1
                continue
    
    # Index remaining documents
    if batch:
        if index_batch(batch, INDEX_NAME):
            print(f"✓ Indexed final batch: {len(batch)} documents")
        else:
            errors += len(batch)
    
    # Summary
    print("-" * 50)
    print(f"Indexing complete!")
    print(f"  Total files processed: {total_files}")
    print(f"  Total lines indexed: {total_lines}")
    print(f"  Errors: {errors}")
    
    # Commit index (make searchable)
    try:
        commit_url = f"{QUICKWIT_URL}/api/v1/{INDEX_NAME}/commit"
        req = Request(commit_url, method='POST')
        with urlopen(req, timeout=30) as response:
            if response.getcode() == 200:
                print(f"✓ Index committed successfully")
            else:
                print(f"Warning: Commit failed: {response.getcode()}")
    except Exception as e:
        print(f"Warning: Could not commit index: {e}")


if __name__ == "__main__":
    index_files()

