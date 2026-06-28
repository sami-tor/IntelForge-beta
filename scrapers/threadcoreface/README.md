# ThreadCoreFace — Threads OSINT & Face Recognition Pipeline

Scrapes Threads profiles, processes face embeddings, and provides a
searchable face recognition database with a Streamlit control panel.

---

## Folder Structure

```
threadcoreface/
├── app/                        # Core application modules
│   ├── armenian_filter.py      # Filters profiles by Armenian ethnicity signals
│   ├── centroid.py             # Face centroid calculation for clustering
│   ├── config.py               # Configuration (DB, API keys, paths)
│   ├── database.py             # SQLAlchemy ORM models (ThreadsUser, ThreadsFace, etc.)
│   ├── faiss_index.py          # FAISS vector index management for face search
│   ├── gpu_face.py             # GPU-accelerated face detection & embedding
│   ├── identity_filter.py      # Identity deduplication filter
│   ├── network_analyzer.py     # Social network graph analysis
│   ├── photo_fetcher.py        # Downloads profile photos from Threads
│   ├── scraper.py              # Core Threads profile scraper
│   ├── search_engine.py        # Face similarity search engine
│   ├── simple_armenian_filter.py # Lightweight Armenian name/bio filter
│   ├── telegram_bot.py         # Telegram bot integration for alerts
│   ├── threads_api.py          # Threads API wrapper (RapidAPI + direct)
│   └── threads_scraper.py      # Threads-specific scraper logic
│
├── tests/                      # Development & regression tests
│   ├── test_api.py             # API endpoint tests
│   ├── test_armenian_filter.py # Armenian filter accuracy tests
│   ├── test_armenian_filter_db.py  # DB-based filter tests
│   ├── test_debug_api.py       # Debug API calls
│   ├── test_debug_api2.py      # Extended debug tests
│   ├── test_debug_api3.py      # Further debug tests
│   ├── test_endpoints.py       # Endpoint discovery tests
│   ├── test_following.py       # Followings scraper tests
│   ├── test_full_api.py        # Full integration test
│   ├── test_gpu.py             # GPU/CUDA availability test
│   ├── test_improved_filter.py # Improved filter tests
│   ├── test_network_analysis.py# Network analysis tests
│   ├── test_scraper_with_db.py # Scraper + DB integration
│   ├── test_simple_filter.py   # Simple filter tests
│   └── test_simple_filter_extended.py  # Extended simple filter tests
│
├── utils/                      # One-off utilities & maintenance scripts
│   ├── analyze_armenian_patterns.py  # Analyze scraped data for Armenian patterns
│   ├── check_armenian_results.py     # Review and validate Armenian filter results
│   ├── check_database.py             # Inspect database contents & stats
│   ├── cleanup_photos.py             # Remove orphaned/invalid photos from disk
│   ├── find_posts_endpoint.py        # Discover Threads API posts endpoints
│   ├── generator.py                  # Generate Armenian phone number CSV list
│   └── transliterate_armenians.py    # Transliterate Armenian Cyrillic names to Latin
│
├── faiss/                      # Persisted FAISS vector index files
├── logs/                       # Application log files
├── migrations/                 # Database migration scripts
├── testimage/                  # Sample images for testing face pipeline
│
│── Entry Points ──────────────────────────────────────────────────────────
│
├── web_app.py          # Streamlit control panel UI — start with: streamlit run web_app.py
├── run_production.py   # Production scraper — full safety features, rate limiting, retries
├── run_scraper.py      # Development scraper — lighter, faster, for testing
├── run_bot.py          # Telegram bot — sends alerts when new profiles are found
├── monitor.py          # Real-time terminal monitoring dashboard (scraping progress)
│
│── Pipeline Stages ───────────────────────────────────────────────────────
│
├── scrape_users.py         # Stage 1: Scrape users and save profiles to database
├── process_faces.py        # Stage 2: Download photos, detect faces, create embeddings
├── expand_network.py       # Stage 3: Expand to followings-of-followings (Level 2+)
├── enhance_with_network.py # Stage 4: Re-score low-confidence users via network analysis
├── deep_network_scraper.py # Advanced: Recursive deep network crawl (multi-level)
│
└── requirements.txt        # Python dependencies
```

---

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the control panel (recommended)
streamlit run web_app.py

# Or run the pipeline manually:
python scrape_users.py        # Stage 1
python process_faces.py       # Stage 2
python expand_network.py      # Stage 3 (optional, for deeper network)
```

## Pipeline Overview

```
Threads API
    │
    ▼
[scrape_users.py]     → Fetches profiles, filters by Armenian signals, saves to DB
    │
    ▼
[process_faces.py]    → Downloads photos, detects faces, generates FAISS embeddings
    │
    ▼
[expand_network.py]   → Gets followings of scraped users → more profiles
    │
    ▼
[enhance_with_network.py] → Re-analyzes low-score users using social graph
    │
    ▼
[FAISS Index]         → Fast face similarity search across all embeddings
```

## Configuration

Edit `app/config.py` or set environment variables:

| Variable | Description |
|---|---|
| `DB_URL` | MySQL database connection string |
| `RAPIDAPI_KEY` | RapidAPI key for Threads API |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for alerts |
| `PHOTOS_DIR` | Directory to store downloaded photos |
| `FAISS_INDEX_PATH` | Path to FAISS index file |
