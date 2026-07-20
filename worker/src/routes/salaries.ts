import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'

const app = new Hono<{ Bindings: Env }>()

app.get('/', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const { startDate, endDate } = c.req.query()

  let query = `
    SELECT sp.*, e.full_name as employee_name
    FROM salary_payments sp
    LEFT JOIN employees e ON sp.employee_id = e.id
  `
  const params: any[] = []
  const conditions: string[] = []

  if (startDate) {
    conditions.push('sp.paid_date >= ?')
    params.push(startDate)
  }
  if (endDate) {
    conditions.push('sp.paid_date <= ?')
    params.push(endDate)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' ORDER BY sp.paid_date DESC'

  const limit = Math.min(500, Math.max(1, parseInt(c.req.query('limit') || '100') || 100))
  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1)
  query += ' LIMIT ? OFFSET ?'
  params.push(limit, (page - 1) * limit)
  const payments = await db.prepare(query).bind(...params).all()

  const countParams = params.slice(0, -2)
  const countQuery = `SELECT COUNT(*) as total FROM salary_payments sp` + (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '')
  const countResult = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>()
  return c.json(payments.results)
})

app.post('/', auth, requireRole('manager'), async (c) => {
  const { employeeId, amount, payMonth, paidDate, notes } = await c.req.json()

  if (!employeeId || amount === undefined || !payMonth) {
    return c.json({ error: 'الموظف والمبلغ والشهر مطلوبة' }, 400)
  }

  const db = getDB(c.env)

  const employee = await db.prepare('SELECT id, monthly_salary FROM employees WHERE id = ?').bind(employeeId).first<{ id: number; monthly_salary: number }>()
  if (!employee) {
    return c.json({ error: 'الموظف غير موجود' }, 404)
  }

  if (amount > employee.monthly_salary) {
    return c.json({ error: `المبلغ (${amount}) يتجاوز الراتب الشهري (${employee.monthly_salary})` }, 400)
  }

  const existing = await db.prepare(
    'SELECT id FROM salary_payments WHERE employee_id = ? AND pay_month = ?'
  ).bind(employeeId, payMonth).first()

  if (existing) {
    return c.json({ error: 'تم صرف راتب هذا الموظف لهذا الشهر بالفعل' }, 409)
  }

  const result = await db.prepare(
    'INSERT INTO salary_payments (employee_id, amount, pay_month, paid_date, notes) VALUES (?, ?, ?, ?, ?)'
  ).bind(employeeId, amount, payMonth, paidDate || null, notes || null).run()

  return c.json({ id: result.meta.last_row_id, message: 'تم تسجيل صرف الراتب' }, 201)
})

export default app
