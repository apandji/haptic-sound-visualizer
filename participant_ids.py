"""
Study participant pseudonym generation.

Names are normalized and keyed with HMAC-SHA256 using a study pepper.
Only lookup_hmac and a sequential participant_code are stored in SQLite — never the name.
"""

import hashlib
import hmac
import os
import re
import sqlite3
from pathlib import Path

_PEPPER_CACHE = None

ROOT = Path(__file__).parent
PEPPER_FILE = ROOT / '.study_pepper'

# Zero-padded numeric participant codes: 000001, 000002, …
PARTICIPANT_CODE_WIDTH = 6


def normalize_participant_name(name: str) -> str:
    """Canonical form for HMAC input (lowercase, collapsed whitespace)."""
    return re.sub(r'\s+', ' ', name.strip().lower())


def get_study_pepper() -> bytes:
    """Load pepper from STUDY_PEPPER env or .study_pepper file (not in git)."""
    global _PEPPER_CACHE
    if _PEPPER_CACHE is not None:
        return _PEPPER_CACHE

    env = os.environ.get('STUDY_PEPPER', '').strip()
    if env:
        _PEPPER_CACHE = env.encode('utf-8')
        return _PEPPER_CACHE

    if PEPPER_FILE.is_file():
        value = PEPPER_FILE.read_text(encoding='utf-8').strip()
        if value:
            _PEPPER_CACHE = value.encode('utf-8')
            return _PEPPER_CACHE

    raise RuntimeError(
        'STUDY_PEPPER not configured. Run scripts/generate_study_pepper.sh '
        'or set the STUDY_PEPPER environment variable.'
    )


def is_pepper_configured() -> bool:
    try:
        get_study_pepper()
        return True
    except RuntimeError:
        return False


def compute_lookup_hmac(normalized_name: str) -> str:
    pepper = get_study_pepper()
    return hmac.new(
        pepper,
        normalized_name.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()


def compute_lookup_hmac_for_name(name: str) -> str:
    """HMAC digest for name lookup. The name is not stored."""
    normalized = normalize_participant_name(name)
    if len(normalized) < 2:
        raise ValueError('Enter at least two characters')
    return compute_lookup_hmac(normalized)


def allocate_next_participant_code(cursor: sqlite3.Cursor) -> str:
    """
    Next sequential zero-padded participant code (000001, 000002, …).
    Ignores legacy non-numeric codes (APANDJI, HSV-*, etc.).
    """
    rows = cursor.execute('SELECT participant_code FROM participants').fetchall()
    max_num = 0
    for row in rows:
        code = row['participant_code'] if isinstance(row, sqlite3.Row) else row[0]
        if str(code).isdigit():
            max_num = max(max_num, int(code))
    return str(max_num + 1).zfill(PARTICIPANT_CODE_WIDTH)
