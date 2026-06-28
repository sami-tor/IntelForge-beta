"""
Cleanup script - keeps only the best photo per user, deletes the rest
Saves ~95% disk space while keeping all embeddings for accuracy
"""

import os
from pathlib import Path
from loguru import logger

from app.config import Config
from app.database import db, ThreadsUser, ThreadsFace

def cleanup_photos():
    """Keep only best photo per user, delete the rest"""

    photos_dir = Config.PHOTOS_DIR

    if not photos_dir.exists():
        logger.info("No photos directory found")
        return

    # Get all photo files
    all_photos = list(photos_dir.glob("*.jpg"))
    logger.info(f"Found {len(all_photos)} photos on disk")

    # Get best photos from database (is_root=1 or highest similarity)
    photos_to_keep = set()

    with db.get_session() as session:
        # Get all users with faces
        users = session.query(ThreadsUser).filter(
            ThreadsUser.status == 'completed'
        ).all()

        for user in users:
            # Get the best face (is_root=1 or highest similarity)
            best_face = session.query(ThreadsFace).filter(
                ThreadsFace.user_id == user.id,
                ThreadsFace.photo_path.isnot(None)
            ).order_by(ThreadsFace.similarity_to_centroid.desc()).first()

            if best_face and best_face.photo_path:
                photos_to_keep.add(Path(best_face.photo_path).name)

    logger.info(f"Photos to keep: {len(photos_to_keep)}")

    # Delete photos not in keep list
    deleted = 0
    kept = 0

    for photo_path in all_photos:
        if photo_path.name in photos_to_keep:
            kept += 1
        else:
            try:
                photo_path.unlink()
                deleted += 1
            except Exception as e:
                logger.error(f"Failed to delete {photo_path}: {e}")

    logger.info(f"Cleanup complete!")
    logger.info(f"  Kept: {kept} photos")
    logger.info(f"  Deleted: {deleted} photos")
    logger.info(f"  Space saved: ~{deleted * 100 / 1024:.1f} MB (estimated)")


def update_photo_paths():
    """Update threads_faces to only have photo_path for best photo per user"""

    with db.get_session() as session:
        users = session.query(ThreadsUser).filter(
            ThreadsUser.status == 'completed'
        ).all()

        updated = 0
        for user in users:
            faces = session.query(ThreadsFace).filter(
                ThreadsFace.user_id == user.id
            ).order_by(ThreadsFace.similarity_to_centroid.desc()).all()

            if not faces:
                continue

            # Keep photo_path only for best face
            for i, face in enumerate(faces):
                if i == 0:
                    # Best face - mark as root
                    face.is_root = 1
                    # Update user's profile photo
                    if face.photo_path:
                        user.profile_photo = face.photo_path
                else:
                    # Other faces - clear photo_path (keep embedding)
                    face.photo_path = None
                    face.is_root = 0
                updated += 1

        session.commit()
        logger.info(f"Updated {updated} face records")


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("PHOTO CLEANUP SCRIPT")
    logger.info("=" * 60)

    db.connect()

    # Step 1: Update database to only track best photo
    logger.info("\nStep 1: Updating database...")
    update_photo_paths()

    # Step 2: Delete extra photos from disk
    logger.info("\nStep 2: Deleting extra photos...")
    cleanup_photos()

    logger.info("\nDone! All embeddings preserved, only best photos kept.")
