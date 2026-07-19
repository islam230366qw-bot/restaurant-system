import type { Env } from './index'

let migrated = false

const migrations: { name: string; sql: string }[] = [
  {
    name: 'migration1',
    sql: `ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_type TEXT DEFAULT 'none';
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage','fixed')),
  discount_value REAL NOT NULL,
  min_order REAL DEFAULT 0,
  max_uses INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);`
  },
  {
    name: 'migration2',
    sql: `ALTER TABLE orders ADD COLUMN voided INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN void_reason TEXT;`
  },
  {
    name: 'migration3',
    sql: `CREATE TABLE IF NOT EXISTS inventory (
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
);`
  },
  {
    name: 'migration4',
    sql: `CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  inventory_item_id INTEGER NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (inventory_item_id) REFERENCES inventory(id)
);`
  },
  {
    name: 'migration5',
    sql: `DROP TABLE IF EXISTS menu_item_ingredients;
ALTER TABLE menu_items ADD COLUMN inventory_item_id INTEGER REFERENCES inventory(id);`
  },
  {
    name: 'migration7',
    sql: `ALTER TABLE orders ADD COLUMN customer_address TEXT DEFAULT '';`
  },
  {
    name: 'migration8',
    sql: `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_voided ON orders(voided);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_inventory_item_id ON menu_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_salary_payments_employee_id ON salary_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_pay_month ON salary_payments(pay_month);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_log_item_id ON inventory_log(item_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);`
  },
  {
    name: 'migration9',
    sql: `CREATE TABLE IF NOT EXISTS token_blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jti TEXT UNIQUE NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'refresh',
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(jti);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);`
  },
  {
    name: 'migration10',
    sql: `ALTER TABLE users ADD COLUMN current_jti TEXT;`
  },
  {
    name: 'migration11',
    sql: `ALTER TABLE order_items ADD COLUMN option_name_snapshot TEXT;`
  },
]

export async function autoMigrate(env: Env): Promise<void> {
  if (migrated) return

  try {
    const db = env.DB
    await db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )`)

    for (const m of migrations) {
      const existing = await db.prepare('SELECT id FROM _migrations WHERE name = ?').bind(m.name).first()
      if (existing) continue

      await db.exec(m.sql)
      await db.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').bind(m.name).run()
    }

    migrated = true
  } catch (err) {
    console.error('Migration error:', err)
  }
}
