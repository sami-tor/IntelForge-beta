"""
Test Armenian filter on existing database users
"""

import sys
import io
from loguru import logger
from app.database import db, ThreadsUser
from app.armenian_filter import armenian_filter

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

logger.remove()
logger.add(sys.stderr, level="INFO")


def test_filter_on_db(limit: int = 100):
    """Test Armenian filter on existing database users"""

    print(f"Testing Armenian filter on {limit} database users...\n")

    db.connect()

    stats = {
        'total': 0,
        'definitely_armenian': 0,
        'probably_armenian': 0,
        'possibly_armenian': 0,
        'not_armenian': 0,
        'scores': []
    }

    examples = {
        'definitely_armenian': [],
        'probably_armenian': [],
        'possibly_armenian': [],
        'not_armenian': []
    }

    with db.get_session() as session:
        users = session.query(ThreadsUser).limit(limit).all()

        for user in users:
            stats['total'] += 1

            # Prepare user data
            user_data = {
                'username': user.username,
                'full_name': user.full_name,
                'biography': user.bio or '',
            }

            # Classify
            result = armenian_filter.classify(user_data)

            # Track stats
            classification = result['classification']
            stats[classification] += 1
            stats['scores'].append(result['score'])

            # Save examples
            if len(examples[classification]) < 5:
                examples[classification].append({
                    'username': user.username,
                    'full_name': user.full_name,
                    'bio': (user.bio or '')[:100],
                    'score': result['score'],
                    'signals': result['signals']
                })

            # Progress every 10
            if stats['total'] % 10 == 0:
                armenian_count = stats['definitely_armenian'] + stats['probably_armenian']
                percentage = (armenian_count / stats['total']) * 100
                print(f"Processed {stats['total']}: {armenian_count} Armenian ({percentage:.1f}%)")

    # Calculate results
    armenian_total = stats['definitely_armenian'] + stats['probably_armenian']
    armenian_percentage = (armenian_total / stats['total']) * 100 if stats['total'] > 0 else 0
    avg_score = sum(stats['scores']) / len(stats['scores']) if stats['scores'] else 0

    # Print results
    print("\n" + "=" * 80)
    print("ARMENIAN FILTER TEST RESULTS")
    print("=" * 80)
    print(f"Total users analyzed:    {stats['total']}")
    print(f"")
    print(f"Definitely Armenian:     {stats['definitely_armenian']} ({stats['definitely_armenian']/stats['total']*100:.1f}%)")
    print(f"Probably Armenian:       {stats['probably_armenian']} ({stats['probably_armenian']/stats['total']*100:.1f}%)")
    print(f"Possibly Armenian:       {stats['possibly_armenian']} ({stats['possibly_armenian']/stats['total']*100:.1f}%)")
    print(f"Not Armenian:            {stats['not_armenian']} ({stats['not_armenian']/stats['total']*100:.1f}%)")
    print(f"")
    print(f"Total Armenian:          {armenian_total} ({armenian_percentage:.1f}%)")
    print(f"Average score:           {avg_score:.1f}")
    print("=" * 80)

    # Show examples
    print("\n" + "=" * 80)
    print("EXAMPLES")
    print("=" * 80)

    for category in ['definitely_armenian', 'probably_armenian', 'not_armenian']:
        if examples[category]:
            print(f"\n{category.upper().replace('_', ' ')}:")
            print("-" * 80)
            for ex in examples[category][:3]:
                print(f"\n@{ex['username']}")
                if ex['full_name']:
                    print(f"  Name: {ex['full_name']}")
                if ex['bio']:
                    print(f"  Bio: {ex['bio']}")
                print(f"  Score: {ex['score']}")
                print(f"  Signals: {ex['signals']}")

    print("\n" + "=" * 80)

    # Score distribution
    print("\nSCORE DISTRIBUTION:")
    score_ranges = [(0, 20), (20, 40), (40, 65), (65, 100)]
    for min_s, max_s in score_ranges:
        count = sum(1 for s in stats['scores'] if min_s <= s < max_s)
        print(f"  {min_s}-{max_s}: {count} users ({count/stats['total']*100:.1f}%)")

    # Recommendations
    print("\n" + "=" * 80)
    print("FILTER TUNING:")
    for threshold in [30, 40, 50, 65]:
        would_accept = sum(1 for s in stats['scores'] if s >= threshold)
        print(f"  Threshold {threshold}: would accept {would_accept}/{stats['total']} users ({would_accept/stats['total']*100:.1f}%)")

    print("\n" + "=" * 80)


if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    test_filter_on_db(limit)
