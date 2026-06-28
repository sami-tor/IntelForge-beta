"""
Threads Face Recognition - Web Control Panel
Beautiful UI to control all scraping and search operations
"""

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import time
import threading
from queue import Queue
import pandas as pd

from app.config import Config
from app.database import db, ThreadsUser, ThreadsFace, RejectedUser
from app.threads_api import threads_api
from app.faiss_index import faiss_index

# Page config
st.set_page_config(
    page_title="Threads Face Recognition",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better styling
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-align: center;
        margin-bottom: 2rem;
    }
    .stat-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 1.5rem;
        border-radius: 1rem;
        color: white;
        text-align: center;
    }
    .stat-number {
        font-size: 2.5rem;
        font-weight: bold;
    }
    .stat-label {
        font-size: 0.9rem;
        opacity: 0.9;
    }
    .success-box {
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
        padding: 1rem;
        border-radius: 0.5rem;
        color: #155724;
    }
    .warning-box {
        background-color: #fff3cd;
        border: 1px solid #ffeeba;
        padding: 1rem;
        border-radius: 0.5rem;
        color: #856404;
    }
    .stProgress > div > div > div > div {
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
if 'scraping_active' not in st.session_state:
    st.session_state.scraping_active = False
if 'scrape_logs' not in st.session_state:
    st.session_state.scrape_logs = []
if 'progress' not in st.session_state:
    st.session_state.progress = {'total': 0, 'current': 0, 'saved': 0, 'rejected': 0, 'duplicates': 0}


def get_database_stats():
    """Get all database statistics"""
    try:
        with db.get_session() as session:
            total_users = session.query(ThreadsUser).count()
            user_saved = session.query(ThreadsUser).filter(ThreadsUser.status == 'user_saved').count()
            processing = session.query(ThreadsUser).filter(ThreadsUser.status == 'processing').count()
            completed = session.query(ThreadsUser).filter(ThreadsUser.status == 'completed').count()
            failed = session.query(ThreadsUser).filter(ThreadsUser.status == 'failed').count()
            total_faces = session.query(ThreadsFace).count()
            rejected = session.query(RejectedUser).count()

            # Get recent users
            recent_users = session.query(ThreadsUser).order_by(
                ThreadsUser.id.desc()
            ).limit(10).all()

            recent_data = [{
                'username': u.username,
                'status': u.status,
                'faces': u.face_count or 0,
                'followers': u.follower_count or 0
            } for u in recent_users]

            return {
                'total_users': total_users,
                'user_saved': user_saved,
                'processing': processing,
                'completed': completed,
                'failed': failed,
                'total_faces': total_faces,
                'rejected': rejected,
                'faiss_size': faiss_index.get_size(),
                'recent_users': recent_data
            }
    except Exception as e:
        st.error(f"Database error: {e}")
        return None


def render_dashboard():
    """Render the main dashboard"""
    st.markdown('<h1 class="main-header">🔍 Threads Face Recognition</h1>', unsafe_allow_html=True)

    stats = get_database_stats()
    if not stats:
        st.error("Could not load database stats")
        return

    # Main metrics row
    col1, col2, col3, col4, col5 = st.columns(5)

    with col1:
        st.metric(
            label="👥 Total Users",
            value=f"{stats['total_users']:,}",
            delta=None
        )

    with col2:
        st.metric(
            label="⏳ Pending",
            value=f"{stats['user_saved']:,}",
            delta=None
        )

    with col3:
        st.metric(
            label="✅ Completed",
            value=f"{stats['completed']:,}",
            delta=None
        )

    with col4:
        st.metric(
            label="😊 Total Faces",
            value=f"{stats['total_faces']:,}",
            delta=None
        )

    with col5:
        st.metric(
            label="🚫 Rejected",
            value=f"{stats['rejected']:,}",
            delta=None
        )

    st.divider()

    # Charts row
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("📊 User Status Distribution")
        status_data = {
            'Status': ['Pending', 'Processing', 'Completed', 'Failed'],
            'Count': [stats['user_saved'], stats['processing'], stats['completed'], stats['failed']]
        }
        fig = px.pie(
            status_data,
            values='Count',
            names='Status',
            color_discrete_sequence=['#ffc107', '#17a2b8', '#28a745', '#dc3545'],
            hole=0.4
        )
        fig.update_layout(margin=dict(t=0, b=0, l=0, r=0))
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.subheader("📈 Index Stats")
        index_info = faiss_index.get_index_info()
        st.info(f"""
        **Index Type:** {index_info.get('type', 'Unknown')}
        **Vectors:** {index_info.get('size', 0):,}
        **Dimension:** {index_info.get('dimension', 512)}
        """)
        if index_info.get('type') == 'HNSW':
            st.success(f"""
            **HNSW Parameters (High Accuracy):**
            M = {index_info.get('M', 64)}
            efSearch = {index_info.get('efSearch', 256)}
            """)

    # Recent users table
    st.subheader("🕐 Recent Users")
    if stats['recent_users']:
        df = pd.DataFrame(stats['recent_users'])
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.info("No users yet")


def render_scrape_users():
    """Render user scraping interface"""
    st.header("📥 Download Users")
    st.write("Enter a username to download all their followings")

    col1, col2 = st.columns([3, 1])

    with col1:
        username = st.text_input(
            "Username",
            placeholder="e.g., n_m.yan",
            label_visibility="collapsed"
        )

    with col2:
        start_button = st.button("🚀 Start Download", type="primary", use_container_width=True)

    if start_button and username:
        scrape_followings_ui(username)

    # Show current progress if scraping
    if st.session_state.scraping_active:
        st.divider()
        progress = st.session_state.progress

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Total Found", progress['total'])
        col2.metric("Saved", progress['saved'])
        col3.metric("Duplicates", progress['duplicates'])
        col4.metric("Rejected", progress['rejected'])

        if progress['total'] > 0:
            st.progress(progress['current'] / progress['total'])


def scrape_followings_ui(username: str):
    """Scrape followings with UI updates"""
    from app.database import RejectedUser

    MAX_FOLLOWERS_THRESHOLD = 25000

    st.session_state.scraping_active = True
    st.session_state.progress = {'total': 0, 'current': 0, 'saved': 0, 'rejected': 0, 'duplicates': 0}

    progress_bar = st.progress(0)
    status_text = st.empty()
    metrics_container = st.container()

    def is_user_exists(uname):
        with db.get_session() as session:
            return session.query(ThreadsUser).filter(ThreadsUser.username == uname).first() is not None

    def is_rejected(uname):
        with db.get_session() as session:
            return session.query(RejectedUser).filter(RejectedUser.username == uname).first() is not None

    def save_user(user_data, source):
        try:
            with db.get_session() as session:
                user = ThreadsUser(
                    username=user_data.get('username'),
                    threads_id=user_data.get('id'),
                    full_name=user_data.get('full_name'),
                    bio=user_data.get('biography', ''),
                    follower_count=user_data.get('follower_count', 0),
                    following_count=user_data.get('following_count', 0),
                    status='user_saved',
                    source_username=source  # Track source
                )
                session.add(user)
                session.commit()
                return True
        except:
            return False

    def save_rejected(uname, reason, follower_count, source):
        try:
            with db.get_session() as session:
                existing = session.query(RejectedUser).filter(RejectedUser.username == uname).first()
                if not existing:
                    rejected = RejectedUser(
                        username=uname,
                        reason=reason,
                        follower_count=follower_count,
                        source_username=source
                    )
                    session.add(rejected)
                    session.commit()
        except:
            pass

    status_text.info(f"🔍 Fetching followings for @{username}...")

    all_users = []

    def process_batch(users_batch):
        all_users.extend(users_batch)
        st.session_state.progress['total'] = len(all_users)

    # Fetch all followings
    threads_api.get_user_following(username, 10000, callback=process_batch)

    total = len(all_users)
    st.session_state.progress['total'] = total

    if total == 0:
        st.error(f"No followings found for @{username}")
        st.session_state.scraping_active = False
        return

    status_text.info(f"📥 Processing {total} users...")

    # Process each user
    for i, user_data in enumerate(all_users):
        uname = user_data.get('username')
        if not uname:
            continue

        follower_count = user_data.get('follower_count', 0)

        # Update progress
        st.session_state.progress['current'] = i + 1
        progress_bar.progress((i + 1) / total)

        # Check follower threshold
        if follower_count > MAX_FOLLOWERS_THRESHOLD:
            save_rejected(uname, 'too_many_followers', follower_count, username)
            st.session_state.progress['rejected'] += 1
            continue

        # Check if exists
        if is_user_exists(uname) or is_rejected(uname):
            st.session_state.progress['duplicates'] += 1
            continue

        # Save user
        if save_user(user_data, username):
            st.session_state.progress['saved'] += 1

        # Update metrics every 10 users
        if i % 10 == 0:
            with metrics_container:
                col1, col2, col3, col4 = st.columns(4)
                col1.metric("Total", total)
                col2.metric("Saved", st.session_state.progress['saved'])
                col3.metric("Duplicates", st.session_state.progress['duplicates'])
                col4.metric("Rejected", st.session_state.progress['rejected'])

    progress_bar.progress(1.0)
    st.session_state.scraping_active = False

    # Final results
    st.success(f"""
    ✅ **Download Complete!**

    - **Total Found:** {total}
    - **Saved:** {st.session_state.progress['saved']}
    - **Duplicates:** {st.session_state.progress['duplicates']}
    - **Rejected (>25k followers):** {st.session_state.progress['rejected']}
    """)


def render_process_faces():
    """Render face processing interface"""
    st.header("😊 Process Faces")

    stats = get_database_stats()
    pending = stats['user_saved'] if stats else 0

    st.info(f"**{pending}** users waiting for face processing")

    col1, col2 = st.columns(2)

    with col1:
        limit = st.number_input("Process limit (0 = all)", min_value=0, value=0, step=10)

    with col2:
        st.write("")
        st.write("")
        process_btn = st.button("🎭 Start Face Processing", type="primary", use_container_width=True)

    if process_btn:
        if pending == 0:
            st.warning("No pending users to process")
        else:
            st.info("⚠️ Face processing runs in terminal. Please run:")
            st.code(f"python process_faces.py {limit if limit > 0 else ''}")


def render_expand_network():
    """Render network expansion interface"""
    st.header("🌐 Expand Network")

    stats = get_database_stats()
    completed = stats['completed'] if stats else 0

    st.info(f"**{completed}** completed users available for expansion")
    st.write("This will get followings of your completed users (Level 2)")

    col1, col2 = st.columns(2)

    with col1:
        limit = st.number_input("Expand limit (0 = all)", min_value=0, value=0, step=10, key="expand_limit")

    with col2:
        st.write("")
        st.write("")
        expand_btn = st.button("🚀 Start Expansion", type="primary", use_container_width=True)

    if expand_btn:
        if completed == 0:
            st.warning("No completed users to expand")
        else:
            st.info("⚠️ Network expansion runs in terminal. Please run:")
            st.code(f"python expand_network.py {limit if limit > 0 else ''}")


def render_face_search():
    """Render face search interface"""
    st.header("🔍 Face Search")

    uploaded_file = st.file_uploader(
        "Upload a photo to search",
        type=['jpg', 'jpeg', 'png'],
        help="Upload a photo containing a face to find matching users"
    )

    if uploaded_file:
        from PIL import Image
        from app.gpu_face import gpu_face
        from app.search_engine import search_engine

        col1, col2 = st.columns(2)

        with col1:
            st.subheader("Uploaded Image")
            image = Image.open(uploaded_file)
            st.image(image, use_container_width=True)

        with col2:
            st.subheader("Search Results")

            with st.spinner("Searching..."):
                # Search
                results = search_engine.search_by_image(image, top_k=5)

            if not results:
                st.warning("No matches found. The person might not be in the database.")
            else:
                for i, result in enumerate(results):
                    similarity_pct = result['similarity'] * 100

                    with st.container():
                        st.markdown(f"""
                        **{i+1}. @{result['username']}**
                        Similarity: **{similarity_pct:.1f}%**
                        Faces: {result['face_count']}
                        [View on Threads]({result['threads_url']})
                        """)
                        st.divider()


def render_manage_sources():
    """Render source management page"""
    st.header("📂 Manage Sources")
    st.write("View and delete users by their source (who they were scraped from)")

    # Get sources stats
    with db.get_session() as session:
        from sqlalchemy import func
        sources = session.query(
            ThreadsUser.source_username,
            func.count(ThreadsUser.id).label('count'),
            func.sum(func.IF(ThreadsUser.status == 'completed', 1, 0)).label('completed'),
            func.sum(func.IF(ThreadsUser.status == 'user_saved', 1, 0)).label('pending')
        ).group_by(ThreadsUser.source_username).all()

        source_data = []
        for s in sources:
            source_data.append({
                'Source': s.source_username or '(Original/Unknown)',
                'Total Users': s.count,
                'Completed': int(s.completed or 0),
                'Pending': int(s.pending or 0)
            })

    if source_data:
        df = pd.DataFrame(source_data)
        st.dataframe(df, use_container_width=True, hide_index=True)

        st.divider()
        st.subheader("🗑️ Delete Users by Source")
        st.warning("This will permanently delete all users from the selected source!")

        # Get list of sources for dropdown
        source_list = [s['Source'] for s in source_data if s['Source'] != '(Original/Unknown)']

        if source_list:
            col1, col2 = st.columns([3, 1])

            with col1:
                selected_source = st.selectbox(
                    "Select source to delete",
                    options=source_list,
                    label_visibility="collapsed"
                )

            with col2:
                delete_btn = st.button("🗑️ Delete All", type="primary", use_container_width=True)

            if delete_btn and selected_source:
                with db.get_session() as session:
                    # Get user IDs to delete from FAISS
                    users_to_delete = session.query(ThreadsUser).filter(
                        ThreadsUser.source_username == selected_source
                    ).all()

                    count = len(users_to_delete)

                    # Delete faces first (foreign key)
                    for user in users_to_delete:
                        session.query(ThreadsFace).filter(ThreadsFace.user_id == user.id).delete()

                    # Delete users
                    session.query(ThreadsUser).filter(
                        ThreadsUser.source_username == selected_source
                    ).delete()

                    session.commit()

                st.success(f"Deleted {count} users from source @{selected_source}")
                st.info("⚠️ Remember to rebuild FAISS index in Settings!")
                st.rerun()
        else:
            st.info("No sources available to delete")
    else:
        st.info("No source data yet")


def render_settings():
    """Render settings page"""
    st.header("⚙️ Settings")

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Database")
        if st.button("🔄 Rebuild FAISS Index"):
            with st.spinner("Rebuilding index..."):
                faiss_index.rebuild_from_db(db)
            st.success("Index rebuilt successfully!")

        st.subheader("Danger Zone")
        if st.button("🗑️ Clear Failed Users", type="secondary"):
            with db.get_session() as session:
                session.query(ThreadsUser).filter(ThreadsUser.status == 'failed').update({'status': 'user_saved'})
                session.commit()
            st.success("Failed users reset to pending!")

    with col2:
        st.subheader("Index Info")
        info = faiss_index.get_index_info()
        st.json(info)


# Sidebar navigation
st.sidebar.title("🎛️ Control Panel")

page = st.sidebar.radio(
    "Navigation",
    ["📊 Dashboard", "📥 Download Users", "😊 Process Faces", "🌐 Expand Network", "🔍 Face Search", "📂 Manage Sources", "⚙️ Settings"],
    label_visibility="collapsed"
)

# Initialize database connection
try:
    db.connect()
    faiss_index.load()
except Exception as e:
    st.error(f"Failed to connect to database: {e}")

# Render selected page
if page == "📊 Dashboard":
    render_dashboard()
elif page == "📥 Download Users":
    render_scrape_users()
elif page == "😊 Process Faces":
    render_process_faces()
elif page == "🌐 Expand Network":
    render_expand_network()
elif page == "🔍 Face Search":
    render_face_search()
elif page == "📂 Manage Sources":
    render_manage_sources()
elif page == "⚙️ Settings":
    render_settings()

# Footer
st.sidebar.divider()
st.sidebar.caption("Made with ❤️ using Streamlit")
