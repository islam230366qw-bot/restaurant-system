import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'

const app = new Hono<{ Bindings: Env }>()

app.get('/', auth, requireRole('manager'), async (c) => {
  try {
    const db = getDB(c.env)
    const { startDate, endDate } = c.req.query()

    if (!startDate || !endDate) {
      return c.json({ error: 'تاريخ البداية والنهاية مطلوبان' }, 400)
    }

    const salesResult = await db.prepare(
      "SELECT COALESCE(SUM(grand_total), 0) as total FROM orders WHERE created_at >= ? AND created_at <= ? AND voided = 0"
    ).bind(startDate, endDate + ' 23:59:59').first<{ total: number }>()

    const expensesResult = await db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date >= ? AND expense_date <= ?"
    ).bind(startDate, endDate).first<{ total: number }>()

    const salariesResult = await db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM salary_payments WHERE paid_date >= ? AND paid_date <= ?"
    ).bind(startDate, endDate).first<{ total: number }>()

    const totalSales = salesResult?.total || 0
    const totalExpenses = expensesResult?.total || 0
    const totalSalaries = salariesResult?.total || 0
    const netProfit = totalSales - (totalExpenses + totalSalaries)

    return c.json({ totalSales, totalExpenses, totalSalaries, netProfit, startDate, endDate })
  } catch {
    return c.json({ error: 'خطأ في حساب الربح' }, 500)
  }
})

export default app
