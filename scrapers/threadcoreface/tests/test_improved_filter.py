"""
Test improved simple Armenian filter
"""

import sys
import io
from loguru import logger
from app.threads_api import threads_api
from app.simple_armenian_filter import simple_armenian_filter

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

logger.remove()
logger.add(sys.stderr, level="INFO")


def test_improved(seed_username: str = 'n_m.yan', limit: int = 500):
    """
    Test improved filter
    """

    print("=" * 80)
    print("IMPROVED SIMPLE ARMENIAN FILTER TEST")
    print("=" * 80)
    print()
    print("Detection rules:")
    print("  1. Armenian surname (yan/ian/jan/syan/tsyan) in username OR full_name")
    print("     - Tolerates extra letters: yannn, iaaaan ✓")
    print("  2. Armenian flag 🇦🇲 in bio")
    print("  3. Armenian Unicode characters (Ա-Ֆ) in name or bio")
    print()
    print(f"Testing on {limit} followings of @{seed_username}...")
    print()
    print("=" * 80)
    print()

    # Fetch followings
    print("Fetching followings from API...")
    followings = []

    def collect_batch(batch):
        followings.extend(batch)
        print(f"  Fetched {len(followings)} users...", end='\r')

    threads_api.get_user_following(seed_username, limit=limit, callback=collect_batch)

    if not followings:
        print("\nNo followings found!")
        return

    print(f"\nFetched {len(followings)} followings")
    print()

    # Classify each
    print("Classifying users...")
    armenian_users = []
    non_armenian_users = []
    detection_reasons = {}

    for user_data in followings:
        username = user_data.get('username', '')
        if not username:
            continue

        result = simple_armenian_filter.classify(user_data)

        if result['is_armenian']:
            reason = result['reason']
            armenian_users.append({
                'username': username,
                'full_name': user_data.get('full_name', ''),
                'bio': (user_data.get('biography', '') or '')[:100],
                'follower_count': user_data.get('follower_count', 0),
                'reason': reason
            })
            detection_reasons[reason] = detection_reasons.get(reason, 0) + 1
        else:
            non_armenian_users.append({
                'username': username,
                'full_name': user_data.get('full_name', ''),
                'bio': (user_data.get('biography', '') or '')[:100],
                'follower_count': user_data.get('follower_count', 0),
            })

    # Results
    total = len(followings)
    armenian_count = len(armenian_users)
    detection_rate = (armenian_count / total * 100) if total > 0 else 0

    print()
    print("=" * 80)
    print("RESULTS")
    print("=" * 80)
    print()
    print(f"Total users:        {total}")
    print(f"Armenian detected:  {armenian_count} ({detection_rate:.1f}%)")
    print(f"Not detected:       {len(non_armenian_users)} ({100-detection_rate:.1f}%)")
    print()
    print("Detection breakdown:")
    for reason, count in sorted(detection_reasons.items(), key=lambda x: x[1], reverse=True):
        print(f"  {reason}: {count} ({count/armenian_count*100:.1f}%)")
    print()

    # Show improvement
    print("=" * 80)
    print("COMPARISON")
    print("=" * 80)
    print()
    print("Old filter (surnames + flag only):        299/500 (59.8%)")
    print(f"New filter (+ Armenian script + extras): {armenian_count}/500 ({detection_rate:.1f}%)")
    improvement = armenian_count - 299
    print(f"Improvement:                               +{improvement} users (+{improvement/5:.1f}%)")
    print()

    # Sample of detected users
    print("=" * 80)
    print("SAMPLE OF DETECTED USERS (first 20)")
    print("=" * 80)
    print()

    for i, user in enumerate(armenian_users[:20], 1):
        print(f"{i}. @{user['username']}")
        if user['full_name']:
            print(f"   Name: {user['full_name']}")
        if user['bio']:
            print(f"   Bio: {user['bio']}")
        print(f"   ✓ Detected: {user['reason']}")
        print()

    # Sample of NOT detected
    print("=" * 80)
    print("STILL NOT DETECTED (Sample of 20)")
    print("=" * 80)
    print()

    for i, user in enumerate(non_armenian_users[:20], 1):
        print(f"{i}. @{user['username']}")
        if user['full_name']:
            print(f"   Name: {user['full_name']}")
        if user['bio']:
            print(f"   Bio: {user['bio']}")
        print()

    print("=" * 80)
    print()
    print("SUMMARY:")
    print(f"Detection rate: {detection_rate:.1f}%")
    print()
    print("This filter catches:")
    print("  ✅ Surnames in username/name (yan, ian, jan, syan, tsyan)")
    print("  ✅ Armenian flag 🇦🇲 in bio")
    print("  ✅ Armenian script (Ա-Ֆ) in name/bio")
    print("  ✅ Tolerates extra letters (yannn, iaaaan)")
    print()
    print("=" * 80)


if __name__ == "__main__":
    seed = sys.argv[1] if len(sys.argv) > 1 else 'n_m.yan'
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 500

    test_improved(seed, limit)
