"""
Scraper orchestrator - coordinates the scraping pipeline
"""

from loguru import logger
from tqdm import tqdm
from sqlalchemy import func

from app.config import Config
from app.database import db, ThreadsUser, ThreadsFace, ScrapeQueue
from app.threads_api import threads_api
from app.photo_fetcher import photo_fetcher
from app.gpu_face import gpu_face
from app.identity_filter import identity_filter
from app.centroid import centroid_builder
from app.faiss_index import faiss_index


class Scraper:
    """Main scraper orchestrator"""

    def __init__(self):
        self.max_photos_per_user = Config.MAX_PHOTOS_PER_USER

    def seed_from_following(self, seed_username: str, limit: int = 100):
        """
        Seed scrape queue from a user's following list

        Args:
            seed_username: Username to get following from
            limit: Maximum number of users to add to queue
        """
        logger.info(f"Seeding queue from {seed_username}'s following...")

        following = threads_api.get_user_following(seed_username, limit)

        if not following:
            logger.error(f"Failed to get following list for {seed_username}")
            return

        with db.get_session() as session:
            added = 0
            for username in following:
                # Check if already in queue
                existing = session.query(ScrapeQueue).filter(
                    ScrapeQueue.username == username
                ).first()

                if not existing:
                    queue_item = ScrapeQueue(username=username, status='pending')
                    session.add(queue_item)
                    added += 1

            session.commit()

        logger.info(f"Added {added} users to scrape queue")

    def scrape_user(self, username: str) -> bool:
        """
        Scrape a single user profile

        Args:
            username: Username to scrape

        Returns:
            True if successful, False otherwise
        """
        logger.info(f"Scraping user: {username}")

        # Get user details
        user_data = threads_api.get_user_details(username)
        if not user_data:
            logger.error(f"Failed to get user details for {username}")
            return False

        # Download profile photo
        profile_photo_path = None
        if user_data.get('profile_photo'):
            profile_photo_path = photo_fetcher.download_profile_photo(
                username, user_data['profile_photo']
            )

        # Get user media
        media_items = threads_api.get_user_media(username, self.max_photos_per_user)

        if not media_items:
            logger.warning(f"No media found for {username}")
            return False

        # Download all photos in parallel
        logger.info(f"Downloading {len(media_items)} photos for {username} in parallel...")
        downloaded_photos = photo_fetcher.download_media_photos_parallel(username, media_items)

        # Process photos and collect face embeddings
        face_embeddings = []
        face_photos = []

        for file_path, img, original_index in tqdm(downloaded_photos, desc=f"Processing {username}"):
            # Stop if we've reached max photos with faces
            if len(face_embeddings) >= self.max_photos_per_user:
                logger.info(f"Reached max photos limit ({self.max_photos_per_user}) for {username}")
                break

            # Detect face and extract embedding
            embedding = gpu_face.process_image(img)

            if embedding is None:
                logger.debug(f"No face in photo {original_index}")
                continue

            # Save photo and embedding temporarily
            face_embeddings.append(embedding)
            face_photos.append((file_path, img))

            logger.info(f"Found face in photo {original_index}")

        if not face_embeddings:
            logger.warning(f"No faces found for {username}")
            return False

        # Filter by identity
        accepted_indices, root_embedding, similarities = identity_filter.filter_faces(face_embeddings)

        if not accepted_indices:
            logger.warning(f"No faces passed identity filter for {username}")
            return False

        # Build centroid from accepted embeddings
        accepted_embeddings = [face_embeddings[i] for i in accepted_indices]
        centroid = centroid_builder.build_centroid(accepted_embeddings)

        # Save to database
        with db.get_session() as session:
            # Create or update user
            user = session.query(ThreadsUser).filter(
                ThreadsUser.username == username
            ).first()

            if not user:
                user = ThreadsUser(
                    username=username,
                    threads_id=user_data.get('threads_id'),
                    full_name=user_data.get('full_name'),
                    bio=user_data.get('bio'),
                    profile_photo=profile_photo_path,
                    follower_count=user_data.get('follower_count', 0),
                    following_count=user_data.get('following_count', 0)
                )
                session.add(user)
                session.flush()
            else:
                # Update follower counts
                user.follower_count = user_data.get('follower_count', 0)
                user.following_count = user_data.get('following_count', 0)

            # Update centroid
            user.set_centroid_embedding(centroid)
            user.face_count = len(accepted_indices)

            # Save accepted face photos
            for i, idx in enumerate(accepted_indices):
                file_path, img = face_photos[idx]

                # Save photo
                photo_fetcher.save_image(img, file_path)

                # Create face record
                face = ThreadsFace(
                    user_id=user.id,
                    photo_path=file_path,
                    similarity_to_centroid=similarities[i],
                    is_root=1 if idx == 0 else 0
                )
                face.set_embedding(face_embeddings[idx])
                session.add(face)

            session.commit()

            # Add to FAISS index
            faiss_index.add_embedding(user.id, centroid)

            logger.info(f"Successfully scraped {username}: {len(accepted_indices)} faces")

        return True

    def process_queue(self, limit: int = None):
        """
        Process scrape queue

        Args:
            limit: Maximum number of users to process (None = all pending)
        """
        logger.info("Processing scrape queue...")

        # Extract data we need before closing session
        pending_items = []
        with db.get_session() as session:
            query = session.query(ScrapeQueue).filter(
                ScrapeQueue.status == 'pending'
            ).order_by(ScrapeQueue.id)

            if limit:
                query = query.limit(limit)

            items = query.all()

            # Extract id and username before session closes
            for item in items:
                pending_items.append({
                    'id': item.id,
                    'username': item.username
                })

            logger.info(f"Found {len(pending_items)} pending users")

        for item_data in tqdm(pending_items, desc="Scraping users"):
            with db.get_session() as session:
                # Update status to processing
                queue_item = session.query(ScrapeQueue).filter(
                    ScrapeQueue.id == item_data['id']
                ).first()

                queue_item.status = 'processing'
                queue_item.last_try = func.now()
                session.commit()

            # Scrape user
            try:
                success = self.scrape_user(item_data['username'])

                with db.get_session() as session:
                    queue_item = session.query(ScrapeQueue).filter(
                        ScrapeQueue.id == item_data['id']
                    ).first()

                    if success:
                        queue_item.status = 'done'
                    else:
                        queue_item.status = 'error'

                    session.commit()

            except Exception as e:
                logger.error(f"Error scraping {item_data['username']}: {e}")

                with db.get_session() as session:
                    queue_item = session.query(ScrapeQueue).filter(
                        ScrapeQueue.id == item_data['id']
                    ).first()

                    queue_item.status = 'error'
                    session.commit()

        logger.info("Queue processing complete")

        # Save FAISS index
        faiss_index.save()


# Global scraper instance
scraper = Scraper()
