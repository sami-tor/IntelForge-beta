"""
Database models and connection layer
"""

from sqlalchemy import create_engine, Column, BigInteger, String, Text, Integer, Float, Enum, TIMESTAMP, LargeBinary, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func
from contextlib import contextmanager
import numpy as np
from loguru import logger

from app.config import Config

Base = declarative_base()


class ThreadsUser(Base):
    """Threads user profile"""
    __tablename__ = 'threads_users'

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    threads_id = Column(BigInteger, index=True)
    full_name = Column(String(255))
    bio = Column(Text)
    country_tag = Column(String(64))
    profile_photo = Column(String(255))
    centroid_embedding = Column(LargeBinary)
    face_count = Column(Integer, default=0)
    follower_count = Column(Integer, default=0)
    following_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    status = Column(Enum('user_saved', 'processing', 'completed', 'failed', name='user_status_enum'), default='user_saved', index=True)
    source_username = Column(String(255), index=True)  # Track where this user came from

    faces = relationship("ThreadsFace", back_populates="user", cascade="all, delete-orphan")

    def get_centroid_embedding(self):
        """Convert BLOB to numpy array"""
        if self.centroid_embedding:
            return np.frombuffer(self.centroid_embedding, dtype=np.float32)
        return None

    def set_centroid_embedding(self, embedding):
        """Convert numpy array to BLOB"""
        if embedding is not None:
            self.centroid_embedding = embedding.astype(np.float32).tobytes()
        else:
            self.centroid_embedding = None


class ThreadsFace(Base):
    """Face photo for a user"""
    __tablename__ = 'threads_faces'

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey('threads_users.id', ondelete='CASCADE'), nullable=False, index=True)
    photo_path = Column(String(255), nullable=False)
    embedding = Column(LargeBinary)
    similarity_to_centroid = Column(Float)
    is_root = Column(Integer, default=0, index=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    user = relationship("ThreadsUser", back_populates="faces")

    def get_embedding(self):
        """Convert BLOB to numpy array"""
        if self.embedding:
            return np.frombuffer(self.embedding, dtype=np.float32)
        return None

    def set_embedding(self, embedding):
        """Convert numpy array to BLOB"""
        if embedding is not None:
            self.embedding = embedding.astype(np.float32).tobytes()
        else:
            self.embedding = None


class ScrapeQueue(Base):
    """Queue for scraping profiles"""
    __tablename__ = 'scrape_queue'

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(Enum('pending', 'processing', 'done', 'error', name='status_enum'), default='pending', index=True)
    last_try = Column(TIMESTAMP, nullable=True)


class RejectedUser(Base):
    """Users that were rejected (too many followers, etc.)"""
    __tablename__ = 'rejected_users'

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    reason = Column(String(100), nullable=False, index=True)
    follower_count = Column(Integer, default=0)
    source_username = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())


class Database:
    """Database connection manager"""

    def __init__(self):
        self.engine = None
        self.SessionLocal = None
        self.connect()

    def connect(self):
        """Connect to database"""
        try:
            db_url = Config.get_db_url()
            self.engine = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_recycle=3600,
                echo=False
            )
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
            logger.info("Database connection established")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    def create_tables(self):
        """Create all tables"""
        try:
            Base.metadata.create_all(bind=self.engine)
            logger.info("Database tables created")
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise

    @contextmanager
    def get_session(self):
        """Get database session context manager"""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            session.close()


# Global database instance
db = Database()
