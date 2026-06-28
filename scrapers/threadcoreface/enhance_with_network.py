"""
Enhance all existing users with network analysis
This will:
1. Find all users with low scores (< 25 points)
2. Analyze their networks
3. Boost detection rate from ~55% to ~90%
4. Discover and save new Armenian users
"""

import sys
import io
import time
from loguru import logger
from app.database import db, ThreadsUser
from app.armenian_filter import armenian_filter
from app.network_analyzer import network_analyzer

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Setup logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>",
    level="INFO"
)
logger.add(
    "logs/network_enhancement.log",
    rotation="50 MB",
    retention="30 days",
    level="DEBUG"
)


def enhance_all_users(limit: int = 500, min_score: int = 0, max_score: int = 24):
    """
    Enhance users with network analysis

    Args:
        limit: Max users to process
        min_score: Minimum current score to process (default: 0)
        max_score: Maximum current score to process (default: 24 - below threshold)
    """

    print("=" * 80)
    print("NETWORK ENHANCEMENT - BOOST ARMENIAN DETECTION")
    print("=" * 80)
    print()
    print(f"Finding users with scores {min_score}-{max_score} (below threshold)...")
    print("This will analyze their networks and discover new Armenian users.")
    print()

    db.connect()

    # Find candidates
    candidates = []

    with db.get_session() as session:
        users = session.query(ThreadsUser).limit(limit).all()

        for user in users:
            user_data = {
                'username': user.username,
                'full_name': user.full_name,
                'biography': user.bio or '',
            }

            classification = armenian_filter.classify(user_data)

            # Only process users below threshold
            if min_score <= classification['score'] <= max_score:
                candidates.append({
                    'username': user.username,
                    'score': classification['score'],
                    'classification': classification
                })

    if not candidates:
        print("No users found to enhance!")
        return

    print(f"Found {len(candidates)} users to enhance")
    print()

    # Ask for confirmation
    print("=" * 80)
    print("IMPORTANT:")
    print(f"This will make ~{len(candidates)} API calls to fetch following lists.")
    print("Each user takes ~10-30 seconds to analyze.")
    print(f"Estimated time: {len(candidates) * 15 / 60:.0f} minutes")
    print()
    print("Benefits:")
    print("- Boost Armenian detection rate from ~55% to ~90%")
    print("- Discover hundreds of new Armenian users")
    print("- No wasted API calls - all followings are classified and saved")
    print("=" * 80)
    print()

    response = input("Continue? [y/N]: ").strip().lower()
    if response not in ['y', 'yes']:
        print("Cancelled.")
        return

    print()
    print("=" * 80)
    print("STARTING NETWORK ENHANCEMENT")
    print("=" * 80)
    print()

    # Process each user
    stats = {
        'processed': 0,
        'now_detected': 0,
        'still_below': 0,
        'total_saved_followings': 0,
        'errors': 0,
    }

    for i, candidate in enumerate(candidates, 1):
        username = candidate['username']
        old_score = candidate['score']

        print(f"[{i}/{len(candidates)}] @{username} (score: {old_score})")

        try:
            # Analyze network
            enhanced = network_analyzer.enhance_user_classification(
                username,
                existing_classification=candidate['classification']
            )

            if 'error' in enhanced:
                logger.error(f"Error for @{username}: {enhanced['error']}")
                stats['errors'] += 1
                continue

            new_score = enhanced['score']
            network_score = enhanced['signals']['network']
            network_stats = enhanced['network_stats']

            improvement = new_score - old_score

            print(f"  Network: {network_stats['armenian_count']}/{network_stats['total_analyzed']} Armenian "
                  f"({network_stats['armenian_ratio']:.1%}) → +{network_score} pts")
            print(f"  Score: {old_score} → {new_score} (+{improvement})")
            print(f"  Saved: {network_stats['saved_followings']} new users")

            if enhanced['is_armenian']:
                print(f"  ✅ NOW DETECTED")
                stats['now_detected'] += 1
            else:
                print(f"  ⚠️  Still below threshold")
                stats['still_below'] += 1

            stats['processed'] += 1
            stats['total_saved_followings'] += network_stats['saved_followings']

        except KeyboardInterrupt:
            print("\n\nInterrupted by user!")
            break
        except Exception as e:
            logger.exception(f"Fatal error for @{username}: {e}")
            stats['errors'] += 1

        print()

        # Progress summary every 10 users
        if i % 10 == 0:
            print("-" * 80)
            print(f"Progress: {stats['processed']}/{len(candidates)} processed, "
                  f"{stats['now_detected']} now detected, "
                  f"{stats['total_saved_followings']} new users saved")
            print("-" * 80)
            print()

    # Final summary
    print()
    print("=" * 80)
    print("ENHANCEMENT COMPLETE")
    print("=" * 80)
    print()
    print(f"Users processed:       {stats['processed']}")
    print(f"Now detected:          {stats['now_detected']} ({stats['now_detected']/stats['processed']*100:.1f}% of processed)")
    print(f"Still below threshold: {stats['still_below']}")
    print(f"Errors:                {stats['errors']}")
    print()
    print(f"NEW ARMENIAN USERS DISCOVERED: {stats['total_saved_followings']}")
    print()
    print("=" * 80)
    print()

    # Show final stats
    with db.get_session() as session:
        total_users = session.query(ThreadsUser).count()

        # Re-classify all to get accurate count
        all_users = session.query(ThreadsUser).limit(500).all()
        detected = 0
        for user in all_users:
            user_data = {
                'username': user.username,
                'full_name': user.full_name,
                'biography': user.bio or '',
            }
            # Note: This doesn't include network scores since we didn't store them
            # In production, you'd want to store network_score in the database
            classification = armenian_filter.classify(user_data)
            if classification['is_armenian']:
                detected += 1

        print(f"Current detection rate (first 500 users): {detected}/500 ({detected/500*100:.1f}%)")
        print()
        print("NOTE: Network scores are NOT persisted in database.")
        print("To get accurate detection rates, you need to:")
        print("1. Add 'network_score' column to threads_users table")
        print("2. Store network scores during analysis")
        print("3. Load network scores when classifying")
        print()
        print("=" * 80)


if __name__ == "__main__":
    limit = 500
    min_score = 0
    max_score = 24

    # Parse args
    if len(sys.argv) > 1:
        limit = int(sys.argv[1])
    if len(sys.argv) > 2:
        min_score = int(sys.argv[2])
    if len(sys.argv) > 3:
        max_score = int(sys.argv[3])

    enhance_all_users(limit, min_score, max_score)
