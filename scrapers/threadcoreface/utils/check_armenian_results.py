"""
Show Armenian filter results for manual verification
"""

import sys
import io
from app.database import db, ThreadsUser
from app.armenian_filter import armenian_filter

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def check_results(limit: int = 50):
    """Show detected Armenians for manual verification"""

    print("=" * 80)
    print("ARMENIAN FILTER - MANUAL VERIFICATION")
    print("=" * 80)
    print()

    db.connect()

    detected_armenians = []

    with db.get_session() as session:
        users = session.query(ThreadsUser).limit(limit).all()

        for user in users:
            user_data = {
                'username': user.username,
                'full_name': user.full_name,
                'biography': user.bio or '',
            }

            classification = armenian_filter.classify(user_data)

            # Show all detected Armenians (threshold 25)
            if classification['score'] >= 25:
                detected_armenians.append({
                    'username': user.username,
                    'full_name': user.full_name,
                    'bio': user.bio or '',
                    'followers': user.follower_count,
                    'score': classification['score'],
                    'classification': classification['classification'],
                    'signals': classification['signals']
                })

    print(f"Checked {limit} users")
    print(f"Found {len(detected_armenians)} Armenian users (score ≥25)")
    print()
    print("=" * 80)
    print()

    for i, user in enumerate(detected_armenians, 1):
        print(f"{i}. @{user['username']}")
        print(f"   Score: {user['score']} ({user['classification'].replace('_', ' ').upper()})")

        if user['full_name']:
            print(f"   Name: {user['full_name']}")

        if user['bio']:
            # Truncate long bios
            bio = user['bio'][:150] + '...' if len(user['bio']) > 150 else user['bio']
            print(f"   Bio: {bio}")

        print(f"   Followers: {user['followers']:,}")

        # Show which signals triggered
        triggered = [signal for signal, score in user['signals'].items() if score > 0]
        if triggered:
            print(f"   Triggered signals: {', '.join(triggered)}")
            print(f"   Signal scores: {user['signals']}")

        print()

    print("=" * 80)
    print()
    print("MANUAL CHECK:")
    print("1. Review each detected user above")
    print("2. Check if they look Armenian (name, bio, location)")
    print("3. If filter is working well, most should be Armenian")
    print("4. If not, we need to adjust weights or add more patterns")
    print()
    print("=" * 80)


if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    check_results(limit)
