"""
Extended Simple Armenian Filter Test
Test on larger sample and analyze patterns for tuning
"""

import sys
import io
import re
from collections import Counter
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
        return (True, 'flag')

    # Check 2: Armenian surname in username
    for pattern in ARMENIAN_SURNAME_PATTERNS:
        if pattern.search(username):
            return (True, 'username_surname')

    # Check 3: Armenian surname in full_name
    for pattern in ARMENIAN_SURNAME_PATTERNS:
        if pattern.search(full_name):
            return (True, 'name_surname')

    return (False, 'no_signal')


def analyze_not_detected(users: list) -> dict:
    """
    Analyze NOT DETECTED users to find patterns
    """
    analysis = {
        'total': len(users),
        'with_cyrillic_names': [],
        'with_armenian_chars': [],
        'short_surnames': [],  # yan/ian with <2 chars before
        'surname_with_extras': [],  # yannn, iaaann etc
        'no_name_no_bio': [],
        'other': []
    }

    # Armenian Unicode range
    armenian_pattern = re.compile(r'[\u0530-\u058F\u0590-\u05FF]+')

    # Cyrillic pattern
    cyrillic_pattern = re.compile(r'[а-яА-ЯёЁ]+')

    # Short surname patterns (1 letter before yan/ian)
    short_surname_patterns = [
        re.compile(r'\b[a-z]yan', re.IGNORECASE),
        re.compile(r'\b[a-z]ian', re.IGNORECASE),
    ]

    # Surname with extra letters
    extra_letters_patterns = [
        re.compile(r'[a-z]{2,}ya+n+', re.IGNORECASE),  # yaaann
        re.compile(r'[a-z]{2,}ia+n+', re.IGNORECASE),  # iaaann
    ]

    for user in users:
        username = user['username']
        full_name = user['full_name']
        bio = user['bio']

        categorized = False

        # Check for Armenian characters
        if armenian_pattern.search(full_name) or armenian_pattern.search(bio):
            analysis['with_armenian_chars'].append(user)
            categorized = True

        # Check for Cyrillic
        elif cyrillic_pattern.search(full_name):
            analysis['with_cyrillic_names'].append(user)
            categorized = True

        # Check for short surnames
        elif any(p.search(username) or p.search(full_name) for p in short_surname_patterns):
            analysis['short_surnames'].append(user)
            categorized = True

        # Check for surname with extra letters
        elif any(p.search(username) for p in extra_letters_patterns):
            analysis['surname_with_extras'].append(user)
            categorized = True

        # Check for empty name and bio
        elif not full_name.strip() and not bio.strip():
            analysis['no_name_no_bio'].append(user)
            categorized = True

        if not categorized:
            analysis['other'].append(user)

    return analysis


def test_extended(seed_username: str = 'n_m.yan', limit: int = 500):
    """
    Extended test on larger sample
    """

    print("=" * 80)
    print("EXTENDED SIMPLE ARMENIAN FILTER TEST")
    print("=" * 80)
    print()
    print("Detection rules:")
    print("  1. Armenian surname (yan/ian/jan/syan/tsyan) in username OR full_name")
    print("     - Minimum 2 chars before suffix (e.g., 'soyan' ✓, 'iian' ✗)")
    print("  2. Armenian flag 🇦🇲 in bio")
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
    detection_reasons = Counter()

    for user_data in followings:
        username = user_data.get('username', '')
        if not username:
            continue

        is_arm, reason = is_armenian(user_data)

        if is_arm:
            armenian_users.append({
                'username': username,
                'full_name': user_data.get('full_name', ''),
                'bio': (user_data.get('biography', '') or '')[:150],
                'follower_count': user_data.get('follower_count', 0),
                'reason': reason
            })
            detection_reasons[reason] += 1
        else:
            non_armenian_users.append({
                'username': username,
                'full_name': user_data.get('full_name', ''),
                'bio': (user_data.get('biography', '') or '')[:150],
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
    for reason, count in detection_reasons.most_common():
        print(f"  {reason}: {count} ({count/armenian_count*100:.1f}%)")
    print()

    # Analyze not detected users
    print("=" * 80)
    print("ANALYZING NOT DETECTED USERS")
    print("=" * 80)
    print()

    analysis = analyze_not_detected(non_armenian_users)

    print(f"Total not detected: {analysis['total']}")
    print()
    print("Categories:")
    print(f"  Armenian characters:     {len(analysis['with_armenian_chars'])} users")
    print(f"  Cyrillic names:          {len(analysis['with_cyrillic_names'])} users")
    print(f"  Short surnames (1 char): {len(analysis['short_surnames'])} users")
    print(f"  Surname with extras:     {len(analysis['surname_with_extras'])} users")
    print(f"  No name/bio:             {len(analysis['no_name_no_bio'])} users")
    print(f"  Other:                   {len(analysis['other'])} users")
    print()

    # Show examples from each category
    print("=" * 80)
    print("EXAMPLES OF MISSED PATTERNS")
    print("=" * 80)
    print()

    if analysis['with_armenian_chars']:
        print("1. ARMENIAN CHARACTERS (Armenian script in name/bio)")
        print("-" * 80)
        for user in analysis['with_armenian_chars'][:5]:
            print(f"@{user['username']}")
            if user['full_name']:
                print(f"  Name: {user['full_name']}")
            if user['bio']:
                print(f"  Bio: {user['bio']}")
            print()

    if analysis['with_cyrillic_names']:
        print("2. CYRILLIC NAMES (Russian/Armenian names in Cyrillic)")
        print("-" * 80)
        for user in analysis['with_cyrillic_names'][:5]:
            print(f"@{user['username']}")
            if user['full_name']:
                print(f"  Name: {user['full_name']}")
            print()

    if analysis['short_surnames']:
        print("3. SHORT SURNAMES (1 letter before yan/ian - e.g., 'iian')")
        print("-" * 80)
        for user in analysis['short_surnames'][:5]:
            print(f"@{user['username']}")
            if user['full_name']:
                print(f"  Name: {user['full_name']}")
            print()

    if analysis['surname_with_extras']:
        print("4. SURNAMES WITH EXTRA LETTERS (e.g., 'arzanyaaann')")
        print("-" * 80)
        for user in analysis['surname_with_extras'][:5]:
            print(f"@{user['username']}")
            if user['full_name']:
                print(f"  Name: {user['full_name']}")
            print()

    if analysis['other']:
        print("5. OTHER (No obvious Armenian signals)")
        print("-" * 80)
        for user in analysis['other'][:10]:
            print(f"@{user['username']}")
            if user['full_name']:
                print(f"  Name: {user['full_name']}")
            if user['bio']:
                print(f"  Bio: {user['bio'][:80]}")
            print()

    # Recommendations
    print("=" * 80)
    print("FILTER TUNING RECOMMENDATIONS")
    print("=" * 80)
    print()

    potential_improvement = 0

    if len(analysis['with_armenian_chars']) > 0:
        improvement = len(analysis['with_armenian_chars']) / total * 100
        potential_improvement += improvement
        print(f"1. ADD: Armenian Unicode characters detection")
        print(f"   → Would catch {len(analysis['with_armenian_chars'])} users (+{improvement:.1f}%)")
        print()

    if len(analysis['with_cyrillic_names']) > 5:
        improvement = len(analysis['with_cyrillic_names']) / total * 100
        potential_improvement += improvement
        print(f"2. ADD: Common Armenian names in Cyrillic (Манушак, Ани, etc.)")
        print(f"   → Would catch ~{len(analysis['with_cyrillic_names'])} users (+{improvement:.1f}%)")
        print()

    if len(analysis['short_surnames']) > 5:
        improvement = len(analysis['short_surnames']) / total * 100
        potential_improvement += improvement
        print(f"3. RELAX: Allow 1-letter surnames (e.g., 'iian', 'ayan')")
        print(f"   → Would catch {len(analysis['short_surnames'])} users (+{improvement:.1f}%)")
        print(f"   ⚠️  May increase false positives")
        print()

    if len(analysis['surname_with_extras']) > 5:
        improvement = len(analysis['surname_with_extras']) / total * 100
        potential_improvement += improvement
        print(f"4. RELAX: Allow extra letters after surnames (yannn, iaaann)")
        print(f"   → Would catch {len(analysis['surname_with_extras'])} users (+{improvement:.1f}%)")
        print()

    print("-" * 80)
    print(f"Current detection:     {detection_rate:.1f}%")
    print(f"Potential with fixes:  {detection_rate + potential_improvement:.1f}%")
    print("=" * 80)
    print()

    print("RECOMMENDED FILTER UPDATES:")
    print("1. ✅ Keep current surname patterns (yan/ian/jan/syan/tsyan)")
    print("2. ✅ Keep Armenian flag 🇦🇲 detection")
    print("3. ➕ ADD Armenian Unicode characters ([\u0530-\u058F])")
    if len(analysis['short_surnames']) > 10:
        print("4. ⚠️  CONSIDER relaxing to 1-letter surnames (may add false positives)")
    if len(analysis['surname_with_extras']) > 10:
        print("5. ➕ ADD tolerance for extra letters (yaaan, iaaaan)")
    print()
    print("=" * 80)


if __name__ == "__main__":
    seed = sys.argv[1] if len(sys.argv) > 1 else 'n_m.yan'
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 500

    test_extended(seed, limit)
