"""
Simple Armenian Filter
Clean, fast detection with high precision:
1. Surname patterns (yan/ian/jan/syan/tsyan) in username or full_name
2. Armenian flag 🇦🇲 in bio
3. Armenian Unicode characters in name/bio
4. Tolerates extra letters after surnames (yannn, iaaaan)
"""

import re
from typing import Tuple


class SimpleArmenianFilter:
    """Simple, fast Armenian user classifier"""

    # Armenian surname patterns (allow extra letters after)
    ARMENIAN_SURNAME_PATTERNS = [
        re.compile(r'[a-z]{2,}ya+n+', re.IGNORECASE),   # -yan, -yaaan, -yannn
        re.compile(r'[a-z]{2,}ia+n+', re.IGNORECASE),   # -ian, -iaaan, -iannn
        re.compile(r'[a-z]{2,}ja+n+', re.IGNORECASE),   # -jan, -jaaan
        re.compile(r'[a-z]{3,}sya+n+', re.IGNORECASE),  # -syan, -syaaan
        re.compile(r'[a-z]{3,}tsya+n+', re.IGNORECASE), # -tsyan, -tsyaaan
    ]

    # Armenian Unicode characters (U+0530 to U+058F)
    ARMENIAN_CHAR_PATTERN = re.compile(r'[\u0530-\u058F]+')

    def __init__(self):
        """Initialize filter"""
        pass

    def is_armenian(self, user_data: dict) -> Tuple[bool, str]:
        """
        Check if user is Armenian

        Args:
            user_data: Dict with 'username', 'full_name', 'biography'/'bio'

        Returns:
            (is_armenian: bool, reason: str)
        """
        username = user_data.get('username', '')
        full_name = user_data.get('full_name', '')
        bio = user_data.get('biography', '') or user_data.get('bio', '')

        # Check 1: Armenian flag emoji
        if '🇦🇲' in bio:
            return (True, 'flag')

        # Check 2: Armenian Unicode characters
        if self.ARMENIAN_CHAR_PATTERN.search(full_name):
            return (True, 'armenian_script_name')
        if self.ARMENIAN_CHAR_PATTERN.search(bio):
            return (True, 'armenian_script_bio')

        # Check 3: Armenian surname in username
        for pattern in self.ARMENIAN_SURNAME_PATTERNS:
            if pattern.search(username):
                return (True, 'username_surname')

        # Check 4: Armenian surname in full_name
        for pattern in self.ARMENIAN_SURNAME_PATTERNS:
            if pattern.search(full_name):
                return (True, 'name_surname')

        return (False, 'no_signal')

    def classify(self, user_data: dict) -> dict:
        """
        Classify user (compatible with old armenian_filter interface)

        Returns:
            {
                'is_armenian': bool,
                'reason': str,
                'confidence': 1.0 if armenian else 0.0
            }
        """
        is_armenian, reason = self.is_armenian(user_data)
        return {
            'is_armenian': is_armenian,
            'reason': reason,
            'confidence': 1.0 if is_armenian else 0.0
        }


# Global instance
simple_armenian_filter = SimpleArmenianFilter()
