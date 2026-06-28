"""
Test threads_scraper with actual database user (with threads_id)
"""
import sys
sys.path.insert(0, '.')

from app.database import db, ThreadsUser
from app.threads_scraper import threads_scraper

# Connect to DB
db.connect()

# Get a user with threads_id from database
with db.get_session() as session:
    user = session.query(ThreadsUser).filter(
        ThreadsUser.status == 'user_saved',
        ThreadsUser.threads_id.isnot(None)
    ).first()

    if user:
        print(f"Testing with user: @{user.username}, threads_id: {user.threads_id}")
        username = user.username
        threads_id = user.threads_id
    else:
        print("No user_saved users with threads_id found")
        # Try any completed user
        user = session.query(ThreadsUser).filter(
            ThreadsUser.threads_id.isnot(None)
        ).first()
        if user:
            print(f"Using completed user: @{user.username}, threads_id: {user.threads_id}")
            username = user.username
            threads_id = user.threads_id
        else:
            print("No users with threads_id found!")
            sys.exit(1)

# Initialize scraper
print("\nInitializing scraper...")
ok = threads_scraper.initialize()
print(f"Initialize result: {ok}")

if not ok:
    print("Failed to initialize!")
    sys.exit(1)

print(f"Cached LSD: {threads_scraper._cached_lsd[:20]}...")
print(f"Session cookies: {dict(threads_scraper.session.cookies)}")

# Test with threads_id (should skip page scraping)
print(f"\nFetching images for @{username} with threads_id={threads_id}...")
images = threads_scraper.get_user_images(username, limit=5, threads_id=threads_id)

print(f"\nResult: {len(images)} images downloaded")
for img, idx in images:
    print(f"  - Image {idx}: {img.size}")
