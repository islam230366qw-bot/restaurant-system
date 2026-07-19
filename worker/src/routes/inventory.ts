import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'
import { validateStr } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const { results } = await db.prepare(
    'SELECT * FROM inventory ORDER BY category, name'
  ).all()
  return c.json(results)
})

app.get('/low-stock', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const { results } = await db.prepare(
    'SELECT * FROM inventory WHERE min_quantity > 0 AND quantity <= min_quantity ORDER BY (quantity * 1.0 / min_quantity)'
  ).all()
  return c.json(results)
})

app.get('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  const db = getDB(c.env)
  const item = await db.prepare('SELECT * FROM inventory WHERE id = ?').bind(id).first()
  if (!item) return c.json({ error: 'الصنف غير موجود' }, 404)
  return c.json(item)
})

app.post('/', auth, requireRole('manager'), async (c) => {
  const { name, category, quantity, unit, minQuantity, unitCost, supplier } = await c.req.json()
  if (!name) return c.json({ error: 'الاسم مطلوب' }, 400)
  const db = getDB(c.env)
  const result = await db.prepare(
    'INSERT INTO inventory (name, category, quantity, unit, min_quantity, unit_cost, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(validateStr(name, 100), validateStr(category || null, 100), quantity || 0, validateStr(unit || 'قطعة', 50), minQuantity || 0, unitCost || 0, validateStr(supplier || null, 200)).run()
  return c.json({ id: result.meta.last_row_id, message: 'تم إضافة الصنف' }, 201)
})

app.put('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id) || id < 1) return c.json({ error: 'معرف غير صالح' }, 400)
  const { name, category, quantity, unit, minQuantity, unitCost, supplier } = await c.req.json()
  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM inventory WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'الصنف غير موجود' }, 404)
  await db.prepare(
    'UPDATE inventory SET name = ?, category = ?, quantity = ?, unit = ?, min_quantity = ?, unit_cost = ?, supplier = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(validateStr(name, 100), validateStr(category || null, 100), quantity || 0, validateStr(unit || 'قطعة', 50), minQuantity || 0, unitCost || 0, validateStr(supplier || null, 200), id).run()
  return c.json({ message: 'تم تحديث الصنف' })
})

app.post('/:id/adjust', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id) || id < 1) return c.json({ error: 'معرف غير صالح' }, 400)
  const { changeType, quantityChange, note } = await c.req.json()
  if (!changeType || quantityChange === undefined) {
    return c.json({ error: 'نوع التغيير والكمية مطلوبان' }, 400)
  }
  const db = getDB(c.env)
  const item = await db.prepare('SELECT id, quantity FROM inventory WHERE id = ?').bind(id).first<{ id: number; quantity: number }>()
  if (!item) return c.json({ error: 'الصنف غير موجود' }, 404)

  const change = changeType === 'remove' ? -quantityChange : quantityChange
  const newQty = Math.max(0, item.quantity + change)

  await db.prepare('UPDATE inventory SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(newQty, id).run()
  await db.prepare(
    'INSERT INTO inventory_log (item_id, change_type, quantity_change, quantity_before, quantity_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, changeType, quantityChange, item.quantity, newQty, note || null, c.get('userId')).run()

  return c.json({ message: 'تم تحديث المخزون', quantityBefore: item.quantity, quantityAfter: newQty })
})

app.get('/:id/log', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id) || id < 1) return c.json({ error: 'معرف غير صالح' }, 400)
  const db = getDB(c.env)
  const { results } = await db.prepare(
    'SELECT l.*, u.full_name as created_by_name FROM inventory_log l LEFT JOIN users u ON l.created_by = u.id WHERE l.item_id = ? ORDER BY l.created_at DESC LIMIT 50'
  ).bind(id).all()
  return c.json(results)
})

app.delete('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id) || id < 1) return c.json({ error: 'معرف غير صالح' }, 400)
  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM inventory WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'الصنف غير موجود' }, 404)
  await db.prepare('DELETE FROM inventory_log WHERE item_id = ?').bind(id).run()
  await db.prepare('DELETE FROM inventory WHERE id = ?').bind(id).run()
  return c.json({ message: 'تم حذف الصنف' })
})

export default app
