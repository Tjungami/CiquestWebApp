PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS ranks;
CREATE TABLE ranks (
    rank_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    required_points INTEGER NOT NULL,
    max_challenges_per_day INTEGER
);

DROP TABLE IF EXISTS users;
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    rank_id INTEGER,
    points INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(rank_id) REFERENCES ranks(rank_id)
);

DROP TABLE IF EXISTS store_owners;
CREATE TABLE store_owners (
    owner_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    approved INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS stores;
CREATE TABLE stores (
    store_id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    business_hours TEXT,
    store_description TEXT,
    qr_code TEXT UNIQUE,
    status TEXT CHECK(status IN ('pending','approved','rejected')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES store_owners(owner_id)
);

DROP TABLE IF EXISTS tags;
CREATE TABLE tags (
    tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    display_order INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1
);
