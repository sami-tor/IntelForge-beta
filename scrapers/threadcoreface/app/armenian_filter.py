"""
Armenian Identity Classifier
Multi-signal scoring system to identify Armenian users
"""

import re
from typing import Dict, Optional, Set
from loguru import logger


class ArmenianFilter:
    """Classify users as Armenian based on multiple signals"""

    # Signal weights (total should allow score up to 100+)
    WEIGHTS = {
        'full_name': 30,
        'bio': 40,
        'network': 50,
        'language': 25,
        'geo': 20,
        'threads_style': 15,
        'username': 25,  # Increased - surnames in usernames are strong signals
    }

    # Armenian names (common first names)
    ARMENIAN_NAMES = {
        # Female names
        'ani', 'anush', 'arpi', 'anahit', 'anahis', 'lilit', 'lusine', 'mariam',
        'maria', 'arus', 'tamara', 'tatev', 'mane', 'aghavni', 'varsenik', 'hasmik',
        'seda', 'gohar', 'nare', 'narine', 'sona', 'siranush', 'nelly', 'anna',
        'gayane', 'zaruhi', 'astghik', 'karine', 'kristine', 'susanna', 'maria',
        'shoghik', 'liana', 'lianna', 'armine', 'naira', 'nvard', 'lili',

        # Male names
        'arman', 'aram', 'armen', 'tigran', 'davit', 'hayk', 'levon', 'hovhannes',
        'samvel', 'gagik', 'vahe', 'karen', 'narek', 'artashes', 'ashot', 'vardan',
        'hovnan', 'suren', 'harutyun', 'ruben', 'edgar', 'raffi', 'vazgen',

        # Common variations
        'lus', 'arpik', 'mari', 'tatevik', 'anushik', 'lilik', 'arusik',
    }

    # Armenian surname patterns (VERY STRONG SIGNAL)
    # These are almost always Armenian
    # Using looser patterns - at least 2 chars before suffix
    ARMENIAN_SURNAME_PATTERNS = [
        r'[a-z]{2,}yan',      # -yan (Petrosyan, Sargsyan, soyan)
        r'[a-z]{2,}ian',      # -ian (Gregorian, Sarkisian)
        r'[a-z]{2,}jan',      # -jan (Abrahamjan)
        r'[a-z]{3,}syan',     # -syan (Manasyan)
        r'[a-z]{3,}tsyan',    # -tsyan (Khachatryan)
    ]

    # Bio keywords (strong signals)
    BIO_KEYWORDS = {
        # Direct mentions
        'armenia', 'yerevan', 'հայ', 'hay', 'hayq', 'հայաստան',
        'armenian', 'армения', 'ереван', 'армянка', 'армянин',

        # Cities
        'gyumri', 'vanadzor', 'kapan', 'dilijan', 'sevan',

        # Cultural
        'tumo', 'cascade', 'vernissage', 'dalma', 'erebuni',

        # Common phrases
        'yerevan city', 'hay girl', 'armenian girl', 'hay axchik',
    }

    # Geo/location keywords
    GEO_KEYWORDS = {
        'yerevan', 'armenia', 'gyumri', 'vanadzor', 'dilijan', 'sevan',
        'cascade', 'republic square', 'erevan', 'ереван', 'армения',
    }

    # Armenian Threads hashtags
    ARMENIAN_HASHTAGS = {
        '#yerevan', '#yerevanlife', '#armenia', '#hay', '#hayastan',
        '#armeniangirl', '#armenianboy', '#cafesyan', '#armgirls',
        '#yerevancity', '#hayq', '#հայաստան', '#հայ',
    }

    # Armenian lexemes in Russian/English text
    ARMENIAN_LEXEMES = {
        'jan', 'джан', 'axper', 'ахпер', 'sirun', 'сирун',
        'janem', 'tghas', 'тгас', 'qez', 'barev', 'барев',
        'shnorhakalutyun', 'shat', 'շատ', 'siro', 'aprel',
    }

    def __init__(self):
        """Initialize filter"""
        # Compile regex patterns for performance
        self._armenian_char_pattern = re.compile(r'[\u0530-\u058F\u0590-\u05FF]+')
        self._name_patterns = self._compile_name_patterns()
        self._surname_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.ARMENIAN_SURNAME_PATTERNS]
        self._bio_pattern = self._compile_bio_pattern()
        self._geo_pattern = self._compile_geo_pattern()
        self._hashtag_pattern = self._compile_hashtag_pattern()
        self._lexeme_pattern = self._compile_lexeme_pattern()

    def _compile_name_patterns(self) -> re.Pattern:
        """Compile regex for Armenian names"""
        # Match whole words, case insensitive
        names = '|'.join(re.escape(name) for name in self.ARMENIAN_NAMES)
        return re.compile(rf'\b({names})\b', re.IGNORECASE)

    def _compile_bio_pattern(self) -> re.Pattern:
        """Compile regex for bio keywords"""
        keywords = '|'.join(re.escape(kw) for kw in self.BIO_KEYWORDS)
        return re.compile(rf'({keywords})', re.IGNORECASE)

    def _compile_geo_pattern(self) -> re.Pattern:
        """Compile regex for geo keywords"""
        keywords = '|'.join(re.escape(kw) for kw in self.GEO_KEYWORDS)
        return re.compile(rf'({keywords})', re.IGNORECASE)

    def _compile_hashtag_pattern(self) -> re.Pattern:
        """Compile regex for Armenian hashtags"""
        tags = '|'.join(re.escape(tag) for tag in self.ARMENIAN_HASHTAGS)
        return re.compile(rf'({tags})', re.IGNORECASE)

    def _compile_lexeme_pattern(self) -> re.Pattern:
        """Compile regex for Armenian lexemes"""
        lexemes = '|'.join(re.escape(lex) for lex in self.ARMENIAN_LEXEMES)
        return re.compile(rf'\b({lexemes})\b', re.IGNORECASE)

    def check_full_name(self, full_name: str) -> int:
        """
        Check if full name contains Armenian names or surnames
        Returns: 0-30 points
        """
        if not full_name:
            return 0

        score = 0

        # Check for Armenian surnames (VERY STRONG)
        for pattern in self._surname_patterns:
            if pattern.search(full_name):
                score += 25  # Surname is almost definitive
                break

        # Check for Armenian first names
        matches = self._name_patterns.findall(full_name.lower())
        if matches:
            score += 15

        return min(score, self.WEIGHTS['full_name'])

    def check_bio(self, bio: str) -> int:
        """
        Check bio for Armenian signals
        Returns: 0-40 points
        """
        if not bio:
            return 0

        score = 0

        # Armenian flag emoji
        if '🇦🇲' in bio:
            score += 30  # Very strong signal

        # Armenian unicode characters
        if self._armenian_char_pattern.search(bio):
            score += 25

        # Bio keywords
        matches = self._bio_pattern.findall(bio)
        if matches:
            score += min(len(matches) * 10, 20)

        return min(score, self.WEIGHTS['bio'])

    def check_username(self, username: str) -> int:
        """
        Check username for Armenian patterns
        Returns: 0-25 points
        - Surname in username: 25 points (VERY STRONG - almost definitive)
        - Armenian name: 15 points
        - Armenian characters: 10 points
        """
        if not username:
            return 0

        # Check for Armenian surnames in username (VERY STRONG)
        # Surnames like "soyan", "kirakosyan", etc. are almost definitive
        for pattern in self._surname_patterns:
            if pattern.search(username):
                return self.WEIGHTS['username']  # Full 25 points

        # Armenian names in username (MODERATE)
        matches = self._name_patterns.findall(username.lower())
        if matches:
            return 15  # Moderate confidence

        # Armenian characters (LOW)
        if self._armenian_char_pattern.search(username):
            return 10  # Low confidence

        return 0

    def check_language(self, text: str) -> int:
        """
        Check text for Armenian language signals
        Returns: 0-25 points
        """
        if not text:
            return 0

        score = 0

        # Armenian unicode characters
        armenian_chars = self._armenian_char_pattern.findall(text)
        if armenian_chars:
            # More chars = higher confidence
            char_count = sum(len(match) for match in armenian_chars)
            score += min(char_count // 5, 20)

        # Armenian lexemes in Russian/English
        lexemes = self._lexeme_pattern.findall(text)
        if lexemes:
            score += min(len(lexemes) * 5, 15)

        return min(score, self.WEIGHTS['language'])

    def check_geo(self, bio: str, text: str) -> int:
        """
        Check for geographic mentions
        Returns: 0-20 points
        """
        combined = f"{bio or ''} {text or ''}"
        if not combined.strip():
            return 0

        # Geo keywords
        geo_matches = self._geo_pattern.findall(combined)
        if geo_matches:
            return self.WEIGHTS['geo']

        return 0

    def check_threads_style(self, bio: str, text: str) -> int:
        """
        Check for Threads-specific Armenian patterns
        Returns: 0-15 points
        """
        combined = f"{bio or ''} {text or ''}"
        if not combined.strip():
            return 0

        score = 0

        # Armenian hashtags
        hashtags = self._hashtag_pattern.findall(combined)
        if hashtags:
            score += min(len(hashtags) * 5, 10)

        # Common Armenian emojis (besides flag)
        armenian_emojis = ['✨', '💛', '🤍', '🧿', '🏔️', '⛪']
        emoji_count = sum(combined.count(emoji) for emoji in armenian_emojis)
        if emoji_count >= 3:
            score += 5

        return min(score, self.WEIGHTS['threads_style'])

    def check_network(self, followers_armenian_ratio: float) -> int:
        """
        Check network connectivity (strongest signal)
        Returns: 0-50 points

        Args:
            followers_armenian_ratio: Ratio of Armenian followers (0.0-1.0)
        """
        if followers_armenian_ratio >= 0.8:
            return self.WEIGHTS['network']
        elif followers_armenian_ratio >= 0.6:
            return int(self.WEIGHTS['network'] * 0.8)
        elif followers_armenian_ratio >= 0.4:
            return int(self.WEIGHTS['network'] * 0.5)
        elif followers_armenian_ratio >= 0.2:
            return int(self.WEIGHTS['network'] * 0.3)

        return 0

    def classify(self, user_data: Dict, followers_armenian_ratio: float = 0.0,
                 sample_text: str = "") -> Dict:
        """
        Classify a user as Armenian

        Args:
            user_data: User data dict with username, full_name, bio
            followers_armenian_ratio: Ratio of Armenian in their network (0-1)
            sample_text: Sample text from posts/comments (optional)

        Returns:
            {
                'is_armenian': bool,
                'confidence': float (0-1),
                'score': int,
                'signals': dict with individual scores
            }
        """
        username = user_data.get('username', '')
        full_name = user_data.get('full_name', '')
        bio = user_data.get('biography', '') or user_data.get('bio', '')

        # Calculate scores for each signal
        signals = {
            'full_name': self.check_full_name(full_name),
            'bio': self.check_bio(bio),
            'username': self.check_username(username),
            'language': self.check_language(bio + ' ' + sample_text),
            'geo': self.check_geo(bio, sample_text),
            'threads_style': self.check_threads_style(bio, sample_text),
            'network': self.check_network(followers_armenian_ratio),
        }

        total_score = sum(signals.values())

        # Classification thresholds (lowered after adding surname detection)
        is_armenian = total_score >= 25  # Lowered - surname alone = 25 pts
        confidence = min(total_score / 100.0, 1.0)

        result = {
            'is_armenian': is_armenian,
            'confidence': confidence,
            'score': total_score,
            'signals': signals,
            'classification': self._get_classification(total_score)
        }

        logger.debug(f"@{username}: score={total_score}, armenian={is_armenian}, signals={signals}")

        return result

    def _get_classification(self, score: int) -> str:
        """Get classification label based on score"""
        if score >= 50:
            return "definitely_armenian"
        elif score >= 25:
            return "probably_armenian"
        elif score >= 15:
            return "possibly_armenian"
        else:
            return "not_armenian"

    def should_process(self, classification: Dict, min_score: int = 25) -> bool:
        """
        Decide if user should be processed

        Args:
            classification: Result from classify()
            min_score: Minimum score threshold (default: 25 - surname detection)

        Returns:
            True if should process, False to skip
        """
        return classification['score'] >= min_score


# Global instance
armenian_filter = ArmenianFilter()
