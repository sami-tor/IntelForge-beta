#!/bin/bash
# Clear indexed files database to force re-indexing
echo "Clearing indexed files database..."
rm -f /tmp/indexed_files.json
echo "✅ Indexed files database cleared. Images will be re-indexed on next scan."

