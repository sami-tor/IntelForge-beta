"""
Network Connectivity Analyzer
Analyzes a user's following list to calculate Armenian ratio
Also saves Armenian followings to database (efficient API usage)
"""

import time
from typing import Dict, List, Tuple
from loguru import logger

from app.threads_api import threads_api
from app.armenian_filter import armenian_filter
from app.database import db, ThreadsUser, RejectedUser
from app.config import Config


class NetworkAnalyzer:
    """Analyze user networks for Armenian connectivity"""

    def __init__(self, max_followings_to_check: int = 100):
        """
        Args:
            max_followings_to_check: Maximum followings to fetch for analysis
                (100 is enough for good statistical sample)
        """
        self.max_followings_to_check = max_followings_to_check
        self.max_followers_threshold = 25000  # Same as scraper

    def is_user_exists(self, username: str) -> bool:
        """Check if user already exists in threads_users table"""
        with db.get_session() as session:
            user = session.query(ThreadsUser).filter(
                ThreadsUser.username == username
            ).first()
            return user is not None

    def is_rejected(self, username: str) -> bool:
        """Check if user is in rejected_users table"""
        with db.get_session() as session:
            rejected = session.query(RejectedUser).filter(
                RejectedUser.username == username
            ).first()
            return rejected is not None

    def save_rejected_user(self, username: str, reason: str, follower_count: int, source: str):
        """Save user to rejected_users table"""
        try:
            with db.get_session() as session:
                rejected = RejectedUser(
                    username=username,
                    reason=reason,
                    follower_count=follower_count,
                    source_username=source
                )
                session.add(rejected)
                session.commit()
        except Exception as e:
            if "Duplicate entry" not in str(e):
                logger.error(f"Error saving rejected user {username}: {e}")

    def save_armenian_following(self, user_data: dict, source_username: str,
                                classification: Dict) -> bool:
        """
        Save Armenian following to database

        Args:
            user_data: User data from API
            source_username: Who we found this user from
            classification: Armenian filter classification result

        Returns:
            True if saved, False if skipped
        """
        username = user_data.get('username')
        if not username:
            return False

        # Check if already exists or rejected
        if self.is_user_exists(username):
            return False
        if self.is_rejected(username):
            return False

        # Check follower count
        follower_count = user_data.get('follower_count', 0)
        if follower_count > self.max_followers_threshold:
            self.save_rejected_user(username, 'too_many_followers',
                                   follower_count, source_username)
            return False

        # Only save if Armenian (score >= 25)
        if classification['score'] < 25:
            return False

        try:
            # Download profile photo
            import requests
            profile_photo_path = None
            photo_url = user_data.get('profile_pic_url')
            if photo_url:
                try:
                    file_path = Config.PROFILES_DIR / f"{username}.jpg"
                    if not file_path.exists():
                        response = requests.get(photo_url, timeout=30)
                        if response.status_code == 200:
                            with open(file_path, 'wb') as f:
                                f.write(response.content)
                            profile_photo_path = str(file_path)
                except Exception as e:
                    logger.debug(f"Error downloading profile photo for {username}: {e}")

            # Save to database
            with db.get_session() as session:
                user = ThreadsUser(
                    username=username,
                    threads_id=user_data.get('id'),
                    full_name=user_data.get('full_name'),
                    bio=user_data.get('biography', ''),
                    profile_photo=profile_photo_path,
                    follower_count=follower_count,
                    following_count=user_data.get('following_count', 0),
                    status='user_saved',
                    source_username=source_username
                )
                session.add(user)
                session.commit()
                logger.debug(f"Saved Armenian following: @{username} (score: {classification['score']})")
                return True
        except Exception as e:
            if "Duplicate entry" not in str(e):
                logger.error(f"Error saving following {username}: {e}")
            return False

    def analyze_network(self, username: str, save_armenian_followings: bool = True) -> Dict:
        """
        Analyze a user's network by fetching their followings

        Args:
            username: Username to analyze
            save_armenian_followings: If True, save Armenian followings to database

        Returns:
            {
                'total_analyzed': int,
                'armenian_count': int,
                'armenian_ratio': float (0-1),
                'network_score': int (0-50 points),
                'saved_followings': int (only if save_armenian_followings=True),
                'error': str (if failed)
            }
        """
        result = {
            'total_analyzed': 0,
            'armenian_count': 0,
            'armenian_ratio': 0.0,
            'network_score': 0,
            'saved_followings': 0,
        }

        try:
            logger.info(f"Analyzing network for @{username}...")

            # Fetch followings (use generator with limit)
            followings = []

            def collect_batch(batch):
                followings.extend(batch)

            threads_api.get_user_following(
                username,
                limit=self.max_followings_to_check,
                callback=collect_batch
            )

            if not followings:
                logger.warning(f"No followings found for @{username}")
                return result

            result['total_analyzed'] = len(followings)

            # Classify each following
            for following_data in followings:
                following_username = following_data.get('username')
                if not following_username:
                    continue

                # Classify as Armenian
                user_data = {
                    'username': following_username,
                    'full_name': following_data.get('full_name', ''),
                    'biography': following_data.get('biography', ''),
                }

                # Classify WITHOUT network signal (to avoid recursion/circular dependency)
                classification = armenian_filter.classify(
                    user_data,
                    followers_armenian_ratio=0.0  # Don't fetch network recursively
                )

                if classification['is_armenian']:
                    result['armenian_count'] += 1

                    # Save to database if enabled
                    if save_armenian_followings:
                        if self.save_armenian_following(following_data, username, classification):
                            result['saved_followings'] += 1

                # Rate limiting
                time.sleep(0.1)

            # Calculate ratio and network score
            if result['total_analyzed'] > 0:
                result['armenian_ratio'] = result['armenian_count'] / result['total_analyzed']
                result['network_score'] = armenian_filter.check_network(result['armenian_ratio'])

            logger.info(
                f"Network analysis for @{username}: "
                f"{result['armenian_count']}/{result['total_analyzed']} Armenian "
                f"({result['armenian_ratio']:.1%}), "
                f"score: {result['network_score']}, "
                f"saved: {result['saved_followings']}"
            )

            return result

        except Exception as e:
            logger.error(f"Error analyzing network for @{username}: {e}")
            result['error'] = str(e)
            return result

    def enhance_user_classification(self, username: str,
                                   existing_classification: Dict = None) -> Dict:
        """
        Enhance user classification with network analysis

        Args:
            username: Username to analyze
            existing_classification: Optional existing classification to enhance

        Returns:
            Enhanced classification with network signal
        """
        # Get existing classification if not provided
        if existing_classification is None:
            with db.get_session() as session:
                user = session.query(ThreadsUser).filter(
                    ThreadsUser.username == username
                ).first()

                if not user:
                    return {'error': f'User @{username} not found in database'}

                user_data = {
                    'username': user.username,
                    'full_name': user.full_name,
                    'biography': user.bio or '',
                }

                existing_classification = armenian_filter.classify(user_data)

        # Analyze network
        network_result = self.analyze_network(username, save_armenian_followings=True)

        # Combine scores
        enhanced_classification = existing_classification.copy()
        enhanced_classification['signals']['network'] = network_result['network_score']
        enhanced_classification['score'] = sum(enhanced_classification['signals'].values())
        enhanced_classification['is_armenian'] = enhanced_classification['score'] >= 25
        enhanced_classification['classification'] = armenian_filter._get_classification(
            enhanced_classification['score']
        )
        enhanced_classification['confidence'] = min(enhanced_classification['score'] / 100.0, 1.0)

        # Add network stats
        enhanced_classification['network_stats'] = {
            'total_analyzed': network_result['total_analyzed'],
            'armenian_count': network_result['armenian_count'],
            'armenian_ratio': network_result['armenian_ratio'],
            'saved_followings': network_result['saved_followings'],
        }

        return enhanced_classification


# Global instance
network_analyzer = NetworkAnalyzer()
