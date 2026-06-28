#!/usr/bin/env python3
"""
IntelForge Telegram Scraper
Scrapes messages and files from Telegram channels/groups
Uses MTProxy for proxy support
"""

import os
import json
import asyncio
import aiofiles
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Set
from urllib.parse import urlparse, parse_qs
from telethon import TelegramClient, events
from telethon.tl.types import MessageMediaDocument, MessageMediaPhoto
from telethon.errors import SessionPasswordNeededError, FloodWaitError

# Configuration — MUST be set via environment variables
# Get your credentials at https://my.telegram.org → API development tools
API_ID = os.getenv("TELEGRAM_API_ID", "")
API_HASH = os.getenv("TELEGRAM_API_HASH", "")
PHONE = os.getenv("TELEGRAM_PHONE", "")
SESSION_NAME = os.getenv("TELEGRAM_SESSION", "telegram_session")
DATA_DIRECTORY = os.getenv("DATA_DIRECTORY", "/data")
CHAT_IDS_FILE = os.getenv("CHAT_IDS_FILE", "/app/chat_ids.txt")
MT_PROXY = os.getenv("MT_PROXY", None)  # Format: secret@host:port

# Validate required credentials
def validate_credentials():
    missing = []
    if not API_ID:
        missing.append("TELEGRAM_API_ID")
    if not API_HASH:
        missing.append("TELEGRAM_API_HASH")
    if not PHONE:
        missing.append("TELEGRAM_PHONE")
    if missing:
        raise RuntimeError(
            f"Telegram scraper is MISSING required environment variables: {', '.join(missing)}\n"
            "Get your credentials at https://my.telegram.org → API development tools\n"
            "Set them via: TELEGRAM_API_ID=your_id TELEGRAM_API_HASH=your_hash TELEGRAM_PHONE=+1234567890 python telegram_scraper.py"
        )

validate_credentials()

class TelegramScraper:
    def __init__(self):
        self.client: Optional[TelegramClient] = None
        self.data_dir = Path(DATA_DIRECTORY)
        self.chat_ids_file = Path(CHAT_IDS_FILE)
        self.monitored_chats: Set[int] = set()
        self.processed_messages: Set[int] = set()
        
        # Create data directory
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Load processed messages (to avoid duplicates)
        self.load_processed_messages()
    
    def load_processed_messages(self):
        """Load list of already processed message IDs"""
        processed_file = self.data_dir / ".processed_messages.json"
        if processed_file.exists():
            try:
                with open(processed_file, 'r') as f:
                    data = json.load(f)
                    self.processed_messages = set(data.get("message_ids", []))
                print(f"📋 Loaded {len(self.processed_messages)} processed messages")
            except:
                self.processed_messages = set()
    
    def save_processed_message(self, message_id: int):
        """Save processed message ID"""
        self.processed_messages.add(message_id)
        processed_file = self.data_dir / ".processed_messages.json"
        try:
            with open(processed_file, 'w') as f:
                json.dump({"message_ids": list(self.processed_messages)}, f)
        except:
            pass
    
    def load_chat_ids(self) -> List[int]:
        """Load channel/group IDs from file"""
        chat_ids = []
        
        # Default channel ID
        default_chat_id = -1003205692912
        chat_ids.append(default_chat_id)
        
        # Load from file if exists
        if self.chat_ids_file.exists():
            try:
                with open(self.chat_ids_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#'):
                            try:
                                chat_id = int(line)
                                chat_ids.append(chat_id)
                            except ValueError:
                                print(f"⚠️  Invalid chat ID in file: {line}")
            except Exception as e:
                print(f"⚠️  Error reading chat_ids.txt: {e}")
        
        return list(set(chat_ids))  # Remove duplicates
    
    async def connect(self):
        """Connect to Telegram with MTProxy support"""
        print("=" * 60)
        print("🚀 IntelForge Telegram Scraper")
        print("=" * 60)
        print(f"API ID: {API_ID}")
        print(f"Phone: {PHONE}")
        print(f"Data Directory: {self.data_dir}")
        print(f"Chat IDs File: {self.chat_ids_file}")
        print("-" * 60)
        
        # Setup MTProxy if provided
        connection = None
        proxy = None
        if MT_PROXY:
            # Parse MTProxy URL format: tg://proxy?server=HOST&port=PORT&secret=SECRET
            # Or simple format: secret@host:port
            host = None
            port = None
            secret = None
            
            if MT_PROXY.startswith('tg://proxy?'):
                # Parse URL format
                parsed = urlparse(MT_PROXY)
                params = parse_qs(parsed.query)
                host = params.get('server', [None])[0]
                port = params.get('port', [None])[0]
                secret = params.get('secret', [None])[0]
            elif '@' in MT_PROXY:
                # Parse simple format: secret@host:port
                secret, host_port = MT_PROXY.split('@', 1)
                if ':' in host_port:
                    host, port = host_port.split(':')
            
            if host and port and secret:
                # Use MTProxy connection type
                from telethon.network import ConnectionTcpMTProxyRandomizedIntermediate
                connection = ConnectionTcpMTProxyRandomizedIntermediate
                # Proxy tuple: (host, port, secret)
                proxy = (host, int(port), secret)
                print(f"🔒 Using MTProxy: {host}:{port}")
            else:
                print(f"⚠️  Invalid MTProxy format: {MT_PROXY}")
        
        # Create client with MTProxy connection
        if connection and proxy:
            self.client = TelegramClient(
                SESSION_NAME,
                int(API_ID),
                API_HASH,
                connection=connection,
                proxy=proxy
            )
        else:
            self.client = TelegramClient(
                SESSION_NAME,
                int(API_ID),
                API_HASH
            )
        
        await self.client.start(phone=PHONE)
        
        # Check if 2FA is required
        if not await self.client.is_user_authorized():
            print("📱 Sending code to your phone...")
            await self.client.send_code_request(PHONE)
            
            code = input("Enter the code you received: ")
            try:
                await self.client.sign_in(PHONE, code)
            except SessionPasswordNeededError:
                password = input("Enter your 2FA password: ")
                await self.client.sign_in(password=password)
        
        print("✅ Connected to Telegram successfully!")
        print(f"👤 Logged in as: {await self.client.get_me()}")
        print("-" * 60)
    
    async def download_file(self, message, file_path: Path):
        """Download file from message"""
        try:
            await self.client.download_media(message, file=str(file_path))
            return True
        except Exception as e:
            print(f"❌ Error downloading file: {e}")
            return False
    
    async def save_message(self, message, chat_id: int):
        """Save message text to file"""
        if not message.text or not message.text.strip():
            return None
        
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        chat_id_abs = abs(chat_id)
        filename = f"telegram-{chat_id_abs}-{timestamp}-{message.id}.txt"
        filepath = self.data_dir / filename
        
        try:
            async with aiofiles.open(filepath, 'w', encoding='utf-8') as f:
                await f.write(message.text)
            return filepath
        except Exception as e:
            print(f"❌ Error saving message: {e}")
            return None
    
    async def process_message(self, message, chat_id: int):
        """Process a new message"""
        message_id = message.id
        
        # Skip if already processed
        if message_id in self.processed_messages:
            return
        
        print(f"📨 New message from chat {chat_id} (ID: {message_id})")
        
        # Save message text
        if message.text:
            filepath = await self.save_message(message, chat_id)
            if filepath:
                print(f"  💾 Saved message to: {filepath}")
                self.save_processed_message(message_id)
        
        # Download files
        if message.media:
            if isinstance(message.media, (MessageMediaDocument, MessageMediaPhoto)):
                timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
                chat_id_abs = abs(chat_id)
                filename = f"telegram-{chat_id_abs}-{timestamp}-{message_id}"
                
                # Get file extension
                if isinstance(message.media, MessageMediaDocument):
                    # Try to get extension from file name first
                    if hasattr(message.media.document, 'attributes'):
                        for attr in message.media.document.attributes:
                            if hasattr(attr, 'file_name') and attr.file_name:
                                import os
                                _, ext = os.path.splitext(attr.file_name)
                                if ext:
                                    filename += ext
                                    break
                    # Fallback to mime type
                    if not filename.endswith(('.', '.txt', '.pdf', '.zip', '.rar', '.7z', '.jpg', '.png', '.docx', '.xlsx')):
                        if message.media.document.mime_type:
                            mime_to_ext = {
                                'application/pdf': '.pdf',
                                'application/zip': '.zip',
                                'application/x-rar-compressed': '.rar',
                                'application/x-7z-compressed': '.7z',
                                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
                                'image/jpeg': '.jpg',
                                'image/png': '.png',
                                'text/plain': '.txt',
                            }
                            ext = mime_to_ext.get(message.media.document.mime_type, '.bin')
                            filename += ext
                        else:
                            filename += '.bin'
                else:
                    filename += ".jpg"
                
                filepath = self.data_dir / filename
                
                if await self.download_file(message, filepath):
                    print(f"  📥 Downloaded file to: {filepath}")
                    self.save_processed_message(message_id)
    
    async def setup_monitoring(self):
        """Setup monitoring for channels/groups"""
        chat_ids = self.load_chat_ids()
        self.monitored_chats = set(chat_ids)
        
        print(f"👀 Monitoring {len(self.monitored_chats)} chats:")
        for chat_id in self.monitored_chats:
            try:
                entity = await self.client.get_entity(chat_id)
                print(f"  - {entity.title or 'Unknown'} ({chat_id})")
            except Exception as e:
                print(f"  - Chat {chat_id} (Error: {e})")
        
        print("-" * 60)
        
        # Setup event handler for new messages
        @self.client.on(events.NewMessage(chats=list(self.monitored_chats)))
        async def handler(event):
            chat_id = event.chat_id
            await self.process_message(event.message, chat_id)
        
        print("✅ Monitoring started. Waiting for new messages...")
        print("=" * 60)
    
    async def scrape_existing_messages(self, limit: int = 100):
        """Scrape existing messages from monitored chats"""
        print("🔍 Scraping existing messages...")
        
        for chat_id in self.monitored_chats:
            try:
                entity = await self.client.get_entity(chat_id)
                print(f"  📂 Scraping: {entity.title or 'Unknown'} ({chat_id})")
                
                count = 0
                async for message in self.client.iter_messages(entity, limit=limit):
                    if message.id not in self.processed_messages:
                        await self.process_message(message, chat_id)
                        count += 1
                        
                        # Small delay to avoid rate limits
                        await asyncio.sleep(0.5)
                
                print(f"  ✅ Scraped {count} new messages from {chat_id}")
            except Exception as e:
                print(f"  ❌ Error scraping {chat_id}: {e}")
        
        print("-" * 60)
    
    async def run(self):
        """Main run loop"""
        try:
            await self.connect()
            await self.setup_monitoring()
            
            # Scrape existing messages first
            await self.scrape_existing_messages(limit=100)
            
            # Keep running and monitor for new messages
            print("🔄 Running... Press Ctrl+C to stop")
            await self.client.run_until_disconnected()
            
        except KeyboardInterrupt:
            print("\n🛑 Stopping scraper...")
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            if self.client:
                await self.client.disconnect()
            print("✅ Telegram scraper stopped")


async def main():
    scraper = TelegramScraper()
    await scraper.run()


if __name__ == "__main__":
    asyncio.run(main())

