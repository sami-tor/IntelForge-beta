"""
Stage 2: Process faces for saved users (FAST VERSION)
- Uses direct Threads scraping (no RapidAPI for media)
- Processes multiple users in parallel
- Detects faces and creates embeddings
- Saves to threads_faces table and updates user centroid
"""

import sys
import time
import os
from loguru import logger
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
from queue import Queue
from threading import Lock

from app.config import Config
from app.database import db, ThreadsUser, ThreadsFace, RejectedUser
from app.threads_scraper import threads_scraper
from app.photo_fetcher import photo_fetcher
from app.gpu_face import gpu_face
from app.identity_filter import identity_filter
from app.centroid import centroid_builder
from app.faiss_index import faiss_index

# Setup logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level="INFO"
)
logger.add(
    Config.LOGS_DIR / "process_faces.log",
    rotation="50 MB",
    retention="30 days",
    level="DEBUG"
)

# Settings
MAX_PHOTOS_PER_USER = 20
SAVE_INDEX_INTERVAL = 50  # Save FAISS index every N users
PARALLEL_USERS = 4  # Process N users simultaneously

# Thread-safe counters
db_lock = Lock()
stats_lock = Lock()


def get_pending_users(limit: int = None) -> list:
    """Get users with status='user_saved' that need face processing"""
    with db.get_session() as session:
        query = session.query(ThreadsUser).filter(
            ThreadsUser.status == 'user_saved'
        ).order_by(ThreadsUser.id)

        if limit:
            query = query.limit(limit)

        users = query.all()

        # Return list of dicts to avoid session issues (include threads_id)
        return [{'id': u.id, 'username': u.username, 'threads_id': u.threads_id} for u in users]


def update_user_status(user_id: int, status: str):
    """Update user status in database (thread-safe)"""
    with db_lock:
        with db.get_session() as session:
            user = session.query(ThreadsUser).get(user_id)
            if user:
                user.status = status
                session.commit()


def save_to_rejected(username: str, reason: str):
    """Save user to rejected_users if face processing fails"""
    try:
        with db_lock:
            with db.get_session() as session:
                existing = session.query(RejectedUser).filter(
                    RejectedUser.username == username
                ).first()
                if not existing:
                    rejected = RejectedUser(
                        username=username,
                        reason=reason,
                        follower_count=0,
                        source_username='face_processing'
                    )
                    session.add(rejected)
                    session.commit()
    except Exception as e:
        if "Duplicate entry" not in str(e):
            logger.error(f"Error saving to rejected: {e}")


def process_user(user_id: int, username: str, threads_id: str = None) -> bool:
    """
    Process a single user - download photos, detect faces, create embeddings

    Returns:
        True if successful (at least 1 face found), False otherwise
    """
    logger.info(f"Processing @{username}...")

    # Update status to processing
    update_user_status(user_id, 'processing')

    # Get user's images directly from Threads (fast, free)
    # Pass threads_id if we have it to skip page scraping
    downloaded_images = threads_scraper.get_user_images(username, MAX_PHOTOS_PER_USER, threads_id=threads_id)

    if not downloaded_images:
        logger.warning(f"No images found for @{username}")
        save_to_rejected(username, 'no_photos')
        return False

    # Process photos and collect face embeddings
    face_embeddings = []
    face_images = []

    for img, original_index in downloaded_images:
        # Stop if we've reached max photos with faces
        if len(face_embeddings) >= MAX_PHOTOS_PER_USER:
            break

        # Detect face and extract embedding
        embedding = gpu_face.process_image(img)

        if embedding is None:
            logger.debug(f"No face in photo {original_index}")
            continue

        # Save photo and embedding temporarily
        face_embeddings.append(embedding)
        face_images.append((img, original_index))
        logger.debug(f"Found face in photo {original_index}")

    if not face_embeddings:
        logger.warning(f"No faces found for @{username}")
        save_to_rejected(username, 'no_faces')
        return False

    # Filter by identity (make sure all faces are the same person)
    accepted_indices, root_embedding, similarities = identity_filter.filter_faces(face_embeddings)

    if not accepted_indices:
        logger.warning(f"No faces passed identity filter for @{username}")
        save_to_rejected(username, 'identity_filter_failed')
        return False

    # Build centroid from accepted embeddings
    accepted_embeddings = [face_embeddings[i] for i in accepted_indices]
    centroid = centroid_builder.build_centroid(accepted_embeddings)

    # Find the best photo (highest similarity to centroid)
    best_idx_in_accepted = similarities.index(max(similarities))

    # Save to database
    with db_lock:
        with db.get_session() as session:
            user = session.query(ThreadsUser).get(user_id)
            if not user:
                logger.error(f"User {user_id} not found in database")
                return False

            # Update centroid
            user.set_centroid_embedding(centroid)
            user.face_count = len(accepted_indices)
            user.status = 'completed'

            # Save ALL embeddings but only ONE best photo
            best_photo_path = None
            for i, idx in enumerate(accepted_indices):
                img, original_index = face_images[idx]

                # Only save the BEST photo to disk (for UI display)
                file_path = None
                if i == best_idx_in_accepted:
                    file_path = str(Config.PHOTOS_DIR / f"{username}_{original_index}.jpg")
                    photo_fetcher.save_image(img, file_path)
                    best_photo_path = file_path
                    logger.debug(f"Saved best photo: {file_path}")

                # Create face record with embedding (photo_path only for best)
                face = ThreadsFace(
                    user_id=user.id,
                    photo_path=file_path,
                    similarity_to_centroid=similarities[i],
                    is_root=1 if i == best_idx_in_accepted else 0
                )
                face.set_embedding(face_embeddings[idx])
                session.add(face)

            session.commit()

            # Add to FAISS index
            faiss_index.add_embedding(user.id, centroid)

            logger.info(f"OK @{username}: {len(accepted_indices)} embeddings, 1 photo")

    return True


def process_all(limit: int = None):
    """Process all pending users with parallel processing"""
    # Get pending users
    pending_users = get_pending_users(limit)

    if not pending_users:
        logger.info("No pending users to process")
        return

    logger.info(f"Found {len(pending_users)} users to process")
    logger.info(f"Using {PARALLEL_USERS} parallel workers")

    # Counters
    processed = 0
    failed = 0
    total = len(pending_users)

    # Progress bar
    pbar = tqdm(total=total, desc="Processing users")

    def process_single(user_data):
        """Process a single user and return result"""
        user_id = user_data['id']
        username = user_data['username']
        threads_id = user_data.get('threads_id')

        try:
            success = process_user(user_id, username, threads_id)
            return (user_id, username, success, None)
        except Exception as e:
            logger.error(f"Error processing @{username}: {e}")
            return (user_id, username, False, str(e))

    # Process users in parallel
    with ThreadPoolExecutor(max_workers=PARALLEL_USERS) as executor:
        futures = {executor.submit(process_single, user): user for user in pending_users}

        for future in as_completed(futures):
            user_id, username, success, error = future.result()

            if success:
                processed += 1

                # Save FAISS index periodically
                if processed % SAVE_INDEX_INTERVAL == 0:
                    logger.info(f"Saving FAISS index ({processed} users processed)...")
                    with db_lock:
                        faiss_index.save()
            else:
                update_user_status(user_id, 'failed')
                failed += 1

            pbar.update(1)
            pbar.set_postfix({'OK': processed, 'FAIL': failed})

    pbar.close()

    # Final save
    logger.info("Saving final FAISS index...")
    faiss_index.save()

    # Stats
    logger.info(f"=" * 80)
    logger.info(f"PROCESSING COMPLETE")
    logger.info(f"=" * 80)
    logger.info(f"Processed: {processed}")
    logger.info(f"Failed:    {failed}")
    logger.info(f"=" * 80)


def get_stats():
    """Get current processing statistics"""
    with db.get_session() as session:
        total = session.query(ThreadsUser).count()
        user_saved = session.query(ThreadsUser).filter(ThreadsUser.status == 'user_saved').count()
        processing = session.query(ThreadsUser).filter(ThreadsUser.status == 'processing').count()
        completed = session.query(ThreadsUser).filter(ThreadsUser.status == 'completed').count()
        failed = session.query(ThreadsUser).filter(ThreadsUser.status == 'failed').count()
        rejected = session.query(RejectedUser).count()
        total_faces = session.query(ThreadsFace).count()

        return {
            'total': total,
            'user_saved': user_saved,
            'processing': processing,
            'completed': completed,
            'failed': failed,
            'rejected': rejected,
            'total_faces': total_faces
        }


def main():
    """Main entry point"""
    # Ensure directories exist
    Config.ensure_dirs()

    # Connect to database
    logger.info("Connecting to database...")
    db.connect()

    # Load FAISS index
    logger.info("Loading FAISS index...")
    faiss_index.load()

    # Initialize Threads scraper
    logger.info("Initializing Threads scraper...")
    if not threads_scraper.initialize():
        logger.error("Failed to initialize Threads scraper, exiting")
        return

    # Show current stats
    stats = get_stats()
    logger.info(f"Current stats:")
    logger.info(f"  Users: {stats['total']} total, {stats['user_saved']} pending, {stats['completed']} completed")
    logger.info(f"  Faces: {stats['total_faces']}")
    logger.info(f"  Rejected: {stats['rejected']}")

    if stats['user_saved'] == 0:
        logger.info("No users to process. Run scrape_users.py first.")
        return

    # Get limit from command line
    limit = None
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
            logger.info(f"Processing limit: {limit} users")
        except ValueError:
            pass

    # Process users
    try:
        process_all(limit)

        # Final stats
        stats = get_stats()
        logger.info(f"Final stats:")
        logger.info(f"  Users: {stats['completed']} completed, {stats['failed']} failed")
        logger.info(f"  Faces: {stats['total_faces']}")
        logger.info(f"  FAISS index: {faiss_index.get_size()} vectors")

    except KeyboardInterrupt:
        logger.warning("Interrupted - saving progress...")
        faiss_index.save()
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    main()
