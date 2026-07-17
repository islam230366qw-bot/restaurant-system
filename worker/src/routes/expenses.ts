import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'
import { validateStr } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const { startDate, endDate, category } = c.req.query()

  let query = `
    SELECT e.*, u.full_name as created_by_name
    FROM expenses e
    LEFT JOIN users u ON e.created_by = u.id
  `
  const params: any[] = []
  const conditions: string[] = []

  if (startDate) {
    conditions.push('e.expense_date >= ?')
    params.push(startDate)
  }
  if (endDate) {
    conditions.push('e.expense_date <= ?')
    params.push(endDate)
  }
  if (category) {
    conditions.push('e.category = ?')
    params.push(category)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' ORDER BY e.expense_date DESC, e.created_at DESC'

  const expenses = await db.prepare(query).bind(...params).all()
  return c.json(expenses.results)
})

app.post('/', auth, requireRole('manager'), async (c) => {
  const { category, amount, expenseDate, description } = await c.req.json()

  if (!category || amount === undefined || !expenseDate) {
    return c.json({ error: 'التصنيف والمبلغ والتاريخ مطلوبة' }, 400)
  }

  const db = getDB(c.env)
  const userId = c.get('userId')

  const result = await db.prepare(
    'INSERT INTO expenses (category, amount, expense_date, description, created_by) VALUES (?, ?, ?, ?, ?)'
  ).bind(validateStr(category, 100), amount, expenseDate, validateStr(description || null, 500), userId).run()

  return c.json({ id: result.meta.last_row_id, message: 'تم إضافة المصروف' }, 201)
})

app.put('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!id) return c.json({ error: 'معرف غير صالح' }, 400)
  const { category, amount, expenseDate, description } = await c.req.json()
  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM expenses WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'المصروف غير موجود' }, 404)

  await db.prepare(
    'UPDATE expenses SET category = ?, amount = ?, expense_date = ?, description = ? WHERE id = ?'
  ).bind(validateStr(category, 100), amount, expenseDate, validateStr(description || null, 500), id).run()

  return c.json({ message: 'تم تحديث المصروف' })
})

app.delete('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!id) return c.json({ error: 'معرف غير صالح' }, 400)
  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM expenses WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'المصروف غير موجود' }, 404)
  await db.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run()
  return c.json({ message: 'تم حذف المصروف' })
})

export default app
