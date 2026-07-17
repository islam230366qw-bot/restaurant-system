CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  quantity REAL DEFAULT 0,
  unit TEXT DEFAULT 'قطعة',
  min_quantity REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  supplier TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER,
  change_type TEXT NOT NULL CHECK(change_type IN ('add','remove','adjust')),
  quantity_change REAL NOT NULL,
  quantity_before REAL NOT NULL,
  quantity_after REAL NOT NULL,
  note TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES inventory(id)
);
