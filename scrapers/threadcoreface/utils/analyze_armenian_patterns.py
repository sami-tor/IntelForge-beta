"""
Comprehensive Armenian pattern analysis
Pulls data from DB + Threads API to understand what signals identify Armenians
"""

import sys
import io
import time
from loguru import logger
from app.database import db, ThreadsUser
from app.armenian_filter import armenian_filter
from app.threads_api import threads_api

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

logger.remove()
logger.add(sys.stderr, level="INFO")


def analyze_user_with_api(user: ThreadsUser, fetch_posts: bool = True):
    """
    Analyze a single user using DB data + API data

    Returns dict with:
    - db_classification: Classification using only DB data
    - api_data: Additional data from API (posts, etc.)
    - enhanced_signals: What signals could be extracted from API data
    """

    # Classification using only DB data (current approach)
    db_user_data = {
        'username': user.username,
        'full_name': user.full_name,
        'biography': user.bio or '',
    }

    db_classification = armenian_filter.classify(db_user_data)

    result = {
        'username': user.username,
        'full_name': user.full_name,
        'bio': (user.bio or '')[:150],
        'follower_count': user.follower_count,
        'following_count': user.following_count,
        'db_score': db_classification['score'],
        'db_classification': db_classification['classification'],
        'db_signals': db_classification['signals'],
    }

    # Fetch additional data from API if requested
    if fetch_posts:
        try:
            # Get user's recent posts
            posts = threads_api.get_user_posts(user.username, limit=10)
            time.sleep(0.5)  # Rate limit

            if posts:
                # Analyze posts for Armenian signals
                all_post_text = ' '.join([
                    (post.get('caption') or '') for post in posts
                ])

                # Extract hashtags
                hashtags = []
                for post in posts:
                    caption = post.get('caption', '')
                    if caption:
                        hashtags.extend([tag for tag in caption.split() if tag.startswith('#')])

                # Check language signals in posts
                language_score = armenian_filter.check_language(all_post_text)
                geo_score = armenian_filter.check_geo(user.bio or '', all_post_text)
                threads_style_score = armenian_filter.check_threads_style(user.bio or '', all_post_text)

                result['api_data'] = {
                    'posts_analyzed': len(posts),
                    'has_armenian_text': language_score > 0,
                    'has_geo_mentions': geo_score > 0,
                    'hashtags_sample': hashtags[:10],
                    'language_score': language_score,
                    'geo_score': geo_score,
                    'threads_style_score': threads_style_score,
                }

                # Calculate enhanced score (DB + post content)
                enhanced_score = db_classification['score']
                if language_score > db_classification['signals']['language']:
                    enhanced_score += (language_score - db_classification['signals']['language'])
                if geo_score > db_classification['signals']['geo']:
                    enhanced_score += (geo_score - db_classification['signals']['geo'])
                if threads_style_score > db_classification['signals']['threads_style']:
                    enhanced_score += (threads_style_score - db_classification['signals']['threads_style'])

                result['enhanced_score'] = enhanced_score
                result['score_improvement'] = enhanced_score - db_classification['score']

        except Exception as e:
            logger.error(f"Error fetching API data for @{user.username}: {e}")
            result['api_data'] = {'error': str(e)}

    return result


def analyze_patterns(limit: int = 100, fetch_posts: bool = False):
    """
    Analyze patterns in database users to understand what signals we're missing
    """

    print("=" * 80)
    print("ARMENIAN PATTERN ANALYSIS")
    print("=" * 80)
    print()

    db.connect()

    stats = {
        'total': 0,
        'db_detected': 0,
        'enhanced_detected': 0,
        'low_score': [],  # Users with score < 25 (not detected)
        'medium_score': [],  # Users with score 25-50
        'high_score': [],  # Users with score 50+
    }

    with db.get_session() as session:
        users = session.query(ThreadsUser).limit(limit).all()

        print(f"Analyzing {len(users)} users...")
        if fetch_posts:
            print("Fetching posts from API (this will take time)...")
        print()

        for i, user in enumerate(users, 1):
            stats['total'] += 1

            result = analyze_user_with_api(user, fetch_posts=fetch_posts)

            # Track DB detection
            if result['db_score'] >= 25:
                stats['db_detected'] += 1

            # Track enhanced detection (if we used API data)
            if fetch_posts and 'enhanced_score' in result:
                if result['enhanced_score'] >= 25:
                    stats['enhanced_detected'] += 1

            # Categorize by score
            score = result.get('enhanced_score', result['db_score'])
            if score < 25:
                if len(stats['low_score']) < 20:  # Keep top 20 examples
                    stats['low_score'].append(result)
            elif score < 50:
                if len(stats['medium_score']) < 10:
                    stats['medium_score'].append(result)
            else:
                if len(stats['high_score']) < 10:
                    stats['high_score'].append(result)

            # Progress
            if i % 10 == 0:
                print(f"Progress: {i}/{limit} users analyzed")

    # Print results
    print()
    print("=" * 80)
    print("ANALYSIS RESULTS")
    print("=" * 80)
    print()
    print(f"Total users analyzed: {stats['total']}")
    print(f"Detected using DB data only: {stats['db_detected']} ({stats['db_detected']/stats['total']*100:.1f}%)")

    if fetch_posts:
        print(f"Detected using enhanced data: {stats['enhanced_detected']} ({stats['enhanced_detected']/stats['total']*100:.1f}%)")
        improvement = stats['enhanced_detected'] - stats['db_detected']
        print(f"Improvement from API data: +{improvement} users")

    print()
    print("=" * 80)
    print("LOW SCORE USERS (< 25 points) - NOT DETECTED")
    print("=" * 80)
    print("These users are NOT being detected. Analyze them to find missing patterns:")
    print()

    for result in stats['low_score'][:10]:
        print(f"@{result['username']}")
        if result['full_name']:
            print(f"  Name: {result['full_name']}")
        if result['bio']:
            print(f"  Bio: {result['bio']}")
        print(f"  Followers: {result['follower_count']:,}")
        print(f"  DB Score: {result['db_score']} | Signals: {result['db_signals']}")

        if fetch_posts and 'api_data' in result and 'error' not in result['api_data']:
            api = result['api_data']
            print(f"  Posts analyzed: {api['posts_analyzed']}")
            if api['has_armenian_text']:
                print(f"    ✓ Has Armenian text in posts (+{api['language_score']} pts)")
            if api['has_geo_mentions']:
                print(f"    ✓ Has geo mentions (+{api['geo_score']} pts)")
            if api['hashtags_sample']:
                print(f"    Hashtags: {', '.join(api['hashtags_sample'][:5])}")
            if 'enhanced_score' in result:
                print(f"  Enhanced Score: {result['enhanced_score']} (+{result['score_improvement']})")

        print()

    print("=" * 80)
    print("PATTERNS TO CONSIDER")
    print("=" * 80)
    print()
    print("To improve detection, consider:")
    print("1. Lower threshold from 25 to 15-20 points")
    print("2. Analyze low-score users manually to find common patterns")
    print("3. Implement network connectivity (analyze followers/following)")
    print("4. Fetch and analyze post content for language/location signals")
    print("5. Add more Armenian name variations")
    print("6. Consider Russian/English names common in Armenia")
    print()

    if not fetch_posts:
        print("TIP: Run with --fetch-posts to analyze post content from API")
        print("  python analyze_armenian_patterns.py 100 --fetch-posts")

    print("=" * 80)


if __name__ == "__main__":
    limit = 100
    fetch_posts = False

    if len(sys.argv) > 1:
        limit = int(sys.argv[1])

    if len(sys.argv) > 2 and sys.argv[2] == '--fetch-posts':
        fetch_posts = True

    analyze_patterns(limit, fetch_posts)
