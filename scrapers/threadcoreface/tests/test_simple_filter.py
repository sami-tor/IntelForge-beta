"""
Simple Armenian Filter Test
Only checks:
1. Surname in username or full_name (yan, ian, jan, syan, tsyan)
2. Armenian flag 🇦🇲 in bio
"""

import sys
import io
import re
from loguru import logger
from app.threads_api import threads_api

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

logger.remove()
logger.add(sys.stderr, level="INFO")


# Simple Armenian surname patterns
ARMENIAN_SURNAME_PATTERNS = [
    re.compile(r'[a-z]{2,}yan', re.IGNORECASE),   # -yan (Petrosyan, Sargsyan, soyan)
    re.compile(r'[a-z]{2,}ian', re.IGNORECASE),   # -ian (Gregorian, Sarkisian)
    re.compile(r'[a-z]{2,}jan', re.IGNORECASE),   # -jan (Abrahamjan)
    re.compile(r'[a-z]{3,}syan', re.IGNORECASE),  # -syan (Manasyan)
    re.compile(r'[a-z]{3,}tsyan', re.IGNORECASE), # -tsyan (Khachatryan)
]


def is_armenian(user_data: dict) -> tuple[bool, str]:
    """
    Simple Armenian check

    Returns:
        (is_armenian, reason)
    """
    username = user_data.get('username', '')
    full_name = user_data.get('full_name', '')
    bio = user_data.get('biography', '') or user_data.get('bio', '')

    # Check 1: Armenian flag emoji
    if '🇦🇲' in bio:
        return (True, '🇦🇲 flag in bio')

    # Check 2: Armenian surname in username
    for pattern in ARMENIAN_SURNAME_PATTERNS:
        if pattern.search(username):
            return (True, f'surname in username: {username}')

    # Check 3: Armenian surname in full_name
    for pattern in ARMENIAN_SURNAME_PATTERNS:
        if pattern.search(full_name):
            return (True, f'surname in name: {full_name}')

    return (False, 'no signals')


def test_simple_filter(seed_username: str = 'n_m.yan', limit: int = 100):
    """
    Test simple Armenian filter on followings
    """

    print("=" * 80)
    print("SIMPLE ARMENIAN FILTER TEST")
    print("=" * 80)
    print()
    print("Detection rules:")
    print("  1. Armenian surname (yan/ian/jan/syan/tsyan) in username OR full_name")
    print("  2. Armenian flag 🇦🇲 in bio")
    print()
    print(f"Testing on {limit} followings of @{seed_username}...")
    print()
    print("=" * 80)
    print()

    # Fetch followings
    followings = []

    def collect_batch(batch):
        followings.extend(batch)

    threads_api.get_user_following(seed_username, limit=limit, callback=collect_batch)

    if not followings:
        print("No followings found!")
        return

    print(f"Fetched {len(followings)} followings")
    print()

    # Classify each
    armenian_users = []
    non_armenian_users = []

    for user_data in followings:
        username = user_data.get('username', '')
        if not username:
            continue

        is_arm, reason = is_armenian(user_data)

        if is_arm:
            armenian_users.append({
                'username': username,
                'full_name': user_data.get('full_name', ''),
                'bio': (user_data.get('biography', '') or '')[:100],
                'follower_count': user_data.get('follower_count', 0),
                'reason': reason
            })
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

    print("=" * 80)
    print("RESULTS")
    print("=" * 80)
    print()
    print(f"Total users:     {total}")
    print(f"Armenian:        {armenian_count} ({detection_rate:.1f}%)")
    print(f"Not Armenian:    {len(non_armenian_users)} ({100-detection_rate:.1f}%)")
    print()

    # Show Armenian users
    print("=" * 80)
    print(f"DETECTED ARMENIAN USERS ({armenian_count})")
    print("=" * 80)
    print()

    for i, user in enumerate(armenian_users[:50], 1):  # Show first 50
        print(f"{i}. @{user['username']}")
        if user['full_name']:
            print(f"   Name: {user['full_name']}")
        if user['bio']:
            print(f"   Bio: {user['bio']}")
        print(f"   Followers: {user['follower_count']:,}")
        print(f"   ✓ Detected: {user['reason']}")
        print()

    if len(armenian_users) > 50:
        print(f"... and {len(armenian_users) - 50} more")
        print()

    # Show some non-Armenian users (to check if we're missing any)
    print("=" * 80)
    print(f"NOT DETECTED ({len(non_armenian_users)}) - Sample of 10")
    print("=" * 80)
    print("Review these to see if we're missing obvious Armenians:")
    print()

    for i, user in enumerate(non_armenian_users[:10], 1):
        print(f"{i}. @{user['username']}")
        if user['full_name']:
            print(f"   Name: {user['full_name']}")
        if user['bio']:
            print(f"   Bio: {user['bio']}")
        print(f"   Followers: {user['follower_count']:,}")
        print()

    print("=" * 80)
    print()
    print("SUMMARY:")
    print(f"Detection rate: {detection_rate:.1f}%")
    print()
    print("This simple filter detected Armenian users based on:")
    print("  • Surname patterns (yan, ian, jan, syan, tsyan)")
    print("  • Armenian flag 🇦🇲 in bio")
    print()
    print("Review the 'NOT DETECTED' section above.")
    print("Do they look Armenian? If yes, we need to add more patterns.")
    print("=" * 80)


if __name__ == "__main__":
    seed = sys.argv[1] if len(sys.argv) > 1 else 'n_m.yan'
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 100

    test_simple_filter(seed, limit)
