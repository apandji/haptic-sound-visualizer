import sqlite3
from pathlib import Path

ROOT = Path(__file__).parent
DB_PATH = ROOT / 'haptic_research.db'
SCHEMA_PATH = ROOT / 'schema.sql'

if DB_PATH.exists():
    DB_PATH.unlink()

conn = sqlite3.connect(DB_PATH)
with SCHEMA_PATH.open('r', encoding='utf-8') as schema_file:
    conn.executescript(schema_file.read())
conn.close()

print(f"Created database at {DB_PATH}")
