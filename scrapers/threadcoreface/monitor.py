"""
Real-time monitoring dashboard for scraping progress
"""

import sys
import time
from datetime import datetime
from sqlalchemy import func, desc

from app.database import db, ThreadsUser, ThreadsFace, ScrapeQueue
from app.config import Config

# Colors for terminal
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def clear_screen():
    """Clear terminal screen"""
    print('\033[2J\033[H', end='')


def print_header():
    """Print dashboard header"""
    print(f"{Colors.BOLD}{Colors.HEADER}=" * 80)
    print(f"THREADS FACE RECOGNITION - MONITORING DASHBOARD")
    print(f"=" * 80 + Colors.ENDC)
    print(f"Time: {Colors.OKCYAN}{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.ENDC}")
    print()


def get_queue_stats():
    """Get queue statistics"""
    with db.get_session() as session:
        stats = {
            'total': session.query(ScrapeQueue).count(),
            'pending': session.query(ScrapeQueue).filter(ScrapeQueue.status == 'pending').count(),
            'processing': session.query(ScrapeQueue).filter(ScrapeQueue.status == 'processing').count(),
            'completed': session.query(ScrapeQueue).filter(ScrapeQueue.status == 'completed').count(),
            'failed': session.query(ScrapeQueue).filter(ScrapeQueue.status == 'failed').count(),
            'skipped': session.query(ScrapeQueue).filter(ScrapeQueue.status == 'skipped').count(),
        }

        # Get recent failed users
        failed_users = session.query(ScrapeQueue).filter(
            ScrapeQueue.status == 'failed'
        ).order_by(desc(ScrapeQueue.id)).limit(5).all()

        stats['recent_failed'] = [(u.username, u.error_message) for u in failed_users]

        return stats


def get_user_stats():
    """Get user statistics"""
    with db.get_session() as session:
        stats = {
            'total': session.query(ThreadsUser).count(),
            'with_centroids': session.query(ThreadsUser).filter(
                ThreadsUser.centroid_embedding.isnot(None)
            ).count(),
            'total_faces': session.query(ThreadsFace).count(),
        }

        # Average faces per user
        result = session.query(func.avg(ThreadsUser.face_count)).filter(
            ThreadsUser.face_count > 0
        ).scalar()
        stats['avg_faces'] = round(result, 1) if result else 0

        # Top users by face count
        top_users = session.query(ThreadsUser).filter(
            ThreadsUser.face_count > 0
        ).order_by(desc(ThreadsUser.face_count)).limit(5).all()

        stats['top_users'] = [(u.username, u.face_count, u.follower_count) for u in top_users]

        # Follower stats
        result = session.query(
            func.avg(ThreadsUser.follower_count),
            func.max(ThreadsUser.follower_count),
            func.min(ThreadsUser.follower_count)
        ).filter(ThreadsUser.follower_count > 0).first()

        if result and result[0]:
            stats['avg_followers'] = int(result[0])
            stats['max_followers'] = int(result[1])
            stats['min_followers'] = int(result[2])
        else:
            stats['avg_followers'] = 0
            stats['max_followers'] = 0
            stats['min_followers'] = 0

        return stats


def print_queue_stats(stats):
    """Print queue statistics"""
    print(f"{Colors.BOLD}SCRAPING QUEUE{Colors.ENDC}")
    print("-" * 80)

    total = stats['total']
    completed = stats['completed']
    pending = stats['pending']
    processing = stats['processing']
    failed = stats['failed']
    skipped = stats['skipped']

    # Calculate progress
    progress = (completed / total * 100) if total > 0 else 0

    print(f"Total Users:      {total:,}")
    print(f"{Colors.OKGREEN}Completed:        {completed:,} ({completed/total*100:.1f}%){Colors.ENDC}" if total > 0 else f"Completed: {completed:,}")
    print(f"{Colors.OKCYAN}Pending:          {pending:,}{Colors.ENDC}")
    print(f"{Colors.WARNING}Processing:       {processing:,}{Colors.ENDC}")
    print(f"{Colors.FAIL}Failed:           {failed:,}{Colors.ENDC}")
    print(f"Skipped:          {skipped:,}")
    print()

    # Progress bar
    bar_length = 50
    filled = int(bar_length * progress / 100)
    bar = '█' * filled + '░' * (bar_length - filled)
    print(f"Progress: [{Colors.OKGREEN}{bar}{Colors.ENDC}] {progress:.1f}%")
    print()

    # Recent failures
    if stats['recent_failed']:
        print(f"{Colors.FAIL}Recent Failures:{Colors.ENDC}")
        for username, error in stats['recent_failed']:
            error_short = (error[:50] + '...') if error and len(error) > 50 else (error or 'unknown')
            print(f"  @{username}: {error_short}")
        print()


def print_user_stats(stats):
    """Print user statistics"""
    print(f"{Colors.BOLD}DATABASE STATISTICS{Colors.ENDC}")
    print("-" * 80)
    print(f"Total Users:      {stats['total']:,}")
    print(f"{Colors.OKGREEN}With Centroids:   {stats['with_centroids']:,}{Colors.ENDC}")
    print(f"Total Faces:      {stats['total_faces']:,}")
    print(f"Avg Faces/User:   {stats['avg_faces']}")
    print()

    # Follower stats
    print(f"Follower Statistics:")
    print(f"  Average:        {stats['avg_followers']:,}")
    print(f"  Maximum:        {stats['max_followers']:,}")
    print(f"  Minimum:        {stats['min_followers']:,}")
    print()

    # Top users
    if stats['top_users']:
        print(f"{Colors.OKBLUE}Top Users by Face Count:{Colors.ENDC}")
        for username, face_count, follower_count in stats['top_users']:
            print(f"  @{username}: {face_count} faces ({follower_count:,} followers)")
        print()


def print_footer():
    """Print dashboard footer"""
    print("-" * 80)
    print(f"{Colors.OKCYAN}Press Ctrl+C to exit | Auto-refresh every 5 seconds{Colors.ENDC}")
    print()


def monitor_loop():
    """Main monitoring loop"""
    try:
        while True:
            clear_screen()
            print_header()

            queue_stats = get_queue_stats()
            user_stats = get_user_stats()

            print_queue_stats(queue_stats)
            print()
            print_user_stats(user_stats)
            print_footer()

            time.sleep(5)

    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Monitoring stopped{Colors.ENDC}")
        sys.exit(0)


def main():
    """Main entry point"""
    # Connect to database
    db.connect()

    # Run monitoring loop
    monitor_loop()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"{Colors.FAIL}Error: {e}{Colors.ENDC}")
        sys.exit(1)
