import type { Env } from './index'

export function getDB(env: Env): D1Database {
  return env.DB
}

export async function enableForeignKeys(db: D1Database): Promise<void> {
  await db.exec('PRAGMA foreign_keys = ON')
}
