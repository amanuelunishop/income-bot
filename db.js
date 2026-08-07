const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'income.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('income','withdrawal')),
    amount REAL NOT NULL,
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

module.exports = db;
