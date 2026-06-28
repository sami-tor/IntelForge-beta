"""
Check database status and rebuild FAISS index
"""

from app.database import db, ThreadsUser, ThreadsFace
from app.faiss_index import faiss_index
from loguru import logger
import sys

logger.remove()
logger.add(sys.stderr, level="INFO")

print("=" * 60)
print("Database and Index Status Check")
print("=" * 60)

# Connect to database
db.connect()

# Check users
with db.get_session() as session:
    user_count = session.query(ThreadsUser).count()
    users_with_centroids = session.query(ThreadsUser).filter(
        ThreadsUser.centroid_embedding.isnot(None)
    ).count()
    face_count = session.query(ThreadsFace).count()

    print(f"\nDatabase Status:")
    print(f"  Total users: {user_count}")
    print(f"  Users with centroids: {users_with_centroids}")
    print(f"  Total face photos: {face_count}")

    if users_with_centroids > 0:
        print(f"\n  Users with centroids:")
        users = session.query(ThreadsUser).filter(
            ThreadsUser.centroid_embedding.isnot(None)
        ).all()
        for user in users:
            print(f"    - @{user.username} ({user.face_count} faces)")

# Check FAISS index
print(f"\nFAISS Index Status:")
index_exists = faiss_index.index_path.exists()
print(f"  Index file exists: {index_exists}")

if index_exists:
    faiss_index.load()
    print(f"  Index size: {faiss_index.get_size()} vectors")
else:
    print(f"  Index file not found")

# Rebuild index if needed
if users_with_centroids > 0 and (not index_exists or faiss_index.get_size() == 0):
    print(f"\n" + "=" * 60)
    print("Rebuilding FAISS index from database...")
    print("=" * 60)

    faiss_index.rebuild_from_db(db)

    print(f"\nIndex rebuilt successfully!")
    print(f"  New index size: {faiss_index.get_size()} vectors")
    print(f"  Index saved to: {faiss_index.index_path}")
elif users_with_centroids == 0:
    print(f"\nNo users with centroids found in database.")
    print(f"You need to run the scraper first: python run_scraper.py")

print("\n" + "=" * 60)
print("Done!")
print("=" * 60)
