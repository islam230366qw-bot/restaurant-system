import type { Env } from './index'

let migrated = false

const migrations: { name: string; sql: string }[] = [
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
