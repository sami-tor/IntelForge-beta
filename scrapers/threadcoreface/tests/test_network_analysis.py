"""
Test network analysis on low-score users
Shows how network connectivity improves Armenian detection
"""

import sys
import io
from loguru import logger
from app.database import db, ThreadsUser
from app.armenian_filter import armenian_filter
from app.network_analyzer import network_analyzer

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

logger.remove()
logger.add(sys.stderr, level="INFO")


def test_network_analysis(limit: int = 20):
    """
    Test network analysis on users with low scores
    """

    print("=" * 80)
    print("NETWORK ANALYSIS TEST")
    print("=" * 80)
    print()
    print("This test will:")
    print("1. Find users with LOW scores (15-24 points)")
    print("2. Analyze their following networks")
    print("3. Show score improvement with network signal")
    print("4. Save Armenian followings to database")
    print()
    print("=" * 80)
    print()

    db.connect()

    # Get users with low scores (likely Armenian but not detected)
    candidates = []

    with db.get_session() as session:
        users = session.query(ThreadsUser).limit(500).all()

        for user in users:
            user_data = {
                'username': user.username,
                'full_name': user.full_name,
                'biography': user.bio or '',
            }

            classification = armenian_filter.classify(user_data)

            # Look for users with scores 15-24 (below threshold but have some signals)
            # Or users with scores 0-14 but following Armenian user n_m.yan
            if 0 <= classification['score'] < 25:
                candidates.append({
                    'username': user.username,
                    'full_name': user.full_name,
                    'bio': (user.bio or '')[:100],
                    'score': classification['score'],
                    'signals': classification['signals'],
                    'classification': classification
                })

                if len(candidates) >= limit:
                    break

    if not candidates:
        print("No low-score users found!")
        return

    print(f"Found {len(candidates)} low-score users to analyze")
    print()

    # Test network analysis on each
    results = []

    for i, candidate in enumerate(candidates[:10], 1):  # Test first 10
        username = candidate['username']

        print(f"\n[{i}/10] Analyzing @{username}...")
        print(f"  Current score: {candidate['score']} (NOT DETECTED)")
        print(f"  Name: {candidate['full_name'] or '(none)'}")
        if candidate['bio']:
            print(f"  Bio: {candidate['bio']}")

        # Analyze network
        enhanced = network_analyzer.enhance_user_classification(
            username,
            existing_classification=candidate['classification']
        )

        if 'error' in enhanced:
            print(f"  ❌ Error: {enhanced['error']}")
            continue

        # Show results
        network_stats = enhanced['network_stats']
        network_score = enhanced['signals']['network']
        new_total_score = enhanced['score']
        score_improvement = new_total_score - candidate['score']

        print(f"\n  Network Analysis:")
        print(f"    Followings analyzed: {network_stats['total_analyzed']}")
        print(f"    Armenian followings: {network_stats['armenian_count']} ({network_stats['armenian_ratio']:.1%})")
        print(f"    Network score: +{network_score} points")
        print(f"    Saved to database: {network_stats['saved_followings']} new Armenian users")
        print(f"\n  Enhanced Classification:")
        print(f"    New score: {new_total_score} (+{score_improvement} points)")
        print(f"    Status: {enhanced['classification'].upper()}")

        if enhanced['is_armenian']:
            print(f"    ✅ NOW DETECTED AS ARMENIAN!")
        else:
            print(f"    ⚠️  Still below threshold (need {25 - new_total_score} more points)")

        results.append({
            'username': username,
            'old_score': candidate['score'],
            'new_score': new_total_score,
            'improvement': score_improvement,
            'network_score': network_score,
            'now_detected': enhanced['is_armenian'],
            'saved_followings': network_stats['saved_followings']
        })

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)

    if not results:
        print("No results to summarize")
        return

    now_detected = sum(1 for r in results if r['now_detected'])
    total_saved = sum(r['saved_followings'] for r in results)
    avg_improvement = sum(r['improvement'] for r in results) / len(results)

    print(f"\nUsers analyzed: {len(results)}")
    print(f"Now detected as Armenian: {now_detected}/{len(results)} ({now_detected/len(results)*100:.1f}%)")
    print(f"Average score improvement: +{avg_improvement:.1f} points")
    print(f"New Armenian users saved: {total_saved}")
    print()

    print("Score distribution:")
    for r in results:
        status = "✅ DETECTED" if r['now_detected'] else "❌ NOT DETECTED"
        print(f"  @{r['username']}: {r['old_score']} → {r['new_score']} (+{r['improvement']}) {status}")

    print("\n" + "=" * 80)
    print("\nCONCLUSION:")
    print(f"Network analysis improved detection by {now_detected/len(results)*100:.1f}%")
    print(f"AND discovered {total_saved} new Armenian users to scrape!")
    print("=" * 80)


if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    test_network_analysis(limit)
