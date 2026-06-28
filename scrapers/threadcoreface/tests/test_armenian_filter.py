"""
Test Armenian filter on a user's followings
"""

import sys
from loguru import logger
from app.threads_api import threads_api
from app.armenian_filter import armenian_filter

logger.remove()
logger.add(sys.stderr, level="INFO")

def test_filter(username: str, limit: int = 100):
    """
    Test Armenian filter on a user's followings

    Args:
        username: Username to get followings from
        limit: Number of followings to test
    """
    print(f"Testing Armenian filter on @{username}'s followings...")
    print(f"Fetching up to {limit} followings...\n")

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
        'not_armenian': []
    }

    def process_batch(users_batch):
        """Process each user"""
        for user_data in users_batch:
            stats['total'] += 1

            # Classify
            result = armenian_filter.classify(user_data)

            # Track stats
            classification = result['classification']
            stats[classification] += 1
            stats['scores'].append(result['score'])

            # Save examples
            if len(examples[classification]) < 5:
                examples[classification].append({
                    'username': user_data.get('username'),
                    'full_name': user_data.get('full_name'),
                    'bio': user_data.get('biography', '')[:100],
                    'score': result['score'],
                    'signals': result['signals']
                })

            # Progress every 10
            if stats['total'] % 10 == 0:
                armenian_count = stats['definitely_armenian'] + stats['probably_armenian']
                percentage = (armenian_count / stats['total']) * 100
                print(f"Processed {stats['total']}: {armenian_count} Armenian ({percentage:.1f}%)")

    # Fetch followings
    threads_api.get_user_following(username, limit, callback=process_batch)

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

    # Recommendations
    print("\nRECOMMENDATIONS:")
    if armenian_percentage >= 70:
        print(f"✓ High Armenian ratio ({armenian_percentage:.1f}%) - filter is working well!")
        print(f"  You can use threshold=40 to capture most Armenians")
    elif armenian_percentage >= 50:
        print(f"✓ Moderate Armenian ratio ({armenian_percentage:.1f}%)")
        print(f"  Consider lowering threshold to 30 to capture more")
    else:
        print(f"⚠ Low Armenian ratio ({armenian_percentage:.1f}%)")
        print(f"  This user may not have many Armenian followings")
        print(f"  Try testing with a known Armenian user")

    print("\n" + "=" * 80)


if __name__ == "__main__":
    # Get username from command line or use default
    username = sys.argv[1] if len(sys.argv) > 1 else "n_m.yan"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 100

    test_filter(username, limit)
