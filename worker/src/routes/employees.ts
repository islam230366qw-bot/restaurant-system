import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'
import { validateStr } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const limit = Math.min(500, Math.max(1, parseInt(c.req.query('limit') || '100') || 100))
  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1)
  const employees = await db.prepare(
    'SELECT * FROM employees ORDER BY is_active DESC, full_name LIMIT ? OFFSET ?'
  ).bind(limit, (page - 1) * limit).all()
  const countResult = await db.prepare('SELECT COUNT(*) as total FROM employees').first<{ total: number }>()
  return c.json({ data: employees.results, total: countResult?.total || 0, page, limit })
})

app.post('/', auth, requireRole('manager'), async (c) => {
  const { fullName, position, monthlySalary, hireDate } = await c.req.json()

  if (!fullName || monthlySalary === undefined) {
    return c.json({ error: 'الاسم والراتب الشهري مطلوبان' }, 400)
  }

  const db = getDB(c.env)
  const result = await db.prepare(
    'INSERT INTO employees (full_name, position, monthly_salary, hire_date) VALUES (?, ?, ?, ?)'
  ).bind(validateStr(fullName, 100), validateStr(position || null, 100), monthlySalary, hireDate || null).run()

  return c.json({ id: result.meta.last_row_id, message: 'تم إضافة الموظف' }, 201)
})

app.put('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id) || id < 1) return c.json({ error: 'معرف غير صالح' }, 400)
  const { fullName, position, monthlySalary, hireDate, isActive } = await c.req.json()
  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM employees WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'الموظف غير موجود' }, 404)

  await db.prepare(
    'UPDATE employees SET full_name = ?, position = ?, monthly_salary = ?, hire_date = ?, is_active = ? WHERE id = ?'
  ).bind(validateStr(fullName, 100), validateStr(position || null, 100), monthlySalary, hireDate || null, isActive ? 1 : 0, id).run()

  return c.json({ message: 'تم تحديث بيانات الموظف' })
})

app.delete('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id) || id < 1) return c.json({ error: 'معرف غير صالح' }, 400)
  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM employees WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'الموظف غير موجود' }, 404)
  await db.prepare('DELETE FROM salary_payments WHERE employee_id = ?').bind(id).run()
  await db.prepare('DELETE FROM employees WHERE id = ?').bind(id).run()

  return c.json({ message: 'تم حذف الموظف' })
})

export default app
