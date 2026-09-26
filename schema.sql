CREATE TABLE IF NOT EXISTS user_address_book (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  address    TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL CHECK (type IN ('wallet', 'pda')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_address_book_type ON user_address_book (type);
