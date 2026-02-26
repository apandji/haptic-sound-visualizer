import sqlite3
conn = sqlite3.connect('haptic_research.db')
with open('schema.sql', 'r') as f:
    conn.executescript(f.read())
conn.close()