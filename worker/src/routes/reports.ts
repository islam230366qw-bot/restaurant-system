import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'

const app = new Hono<{ Bindings: Env }>()

app.get('/sales', auth, requireRole('manager'), async (c) => {
  try {
    const db = getDB(c.env)
    const { startDate, endDate } = c.req.query()

    let query = `
      SELECT o.id as order_id, o.customer_name, o.customer_phone, o.payment_method,
             o.subtotal, o.service_amount, o.tax_amount, o.grand_total,
             o.created_at, u.full_name as created_by_name,
             oi.item_name_snapshot, oi.unit_price_snapshot, oi.quantity, oi.subtotal as item_subtotal
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
    `
    const params: any[] = []
    const conditions: string[] = []

    if (startDate) {
      conditions.push('o.created_at >= ?')
      params.push(startDate)
    }
    if (endDate) {
      conditions.push('o.created_at <= ?')
      params.push(endDate + ' 23:59:59')
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY o.created_at DESC'

    const data = await db.prepare(query).bind(...params).all()
    return c.json(data.results)
  } catch {
    return c.json({ error: 'خطأ في تحميل التقرير' }, 500)
  }
})

app.get('/expenses', auth, requireRole('manager'), async (c) => {
  try {
    const db = getDB(c.env)
    const { startDate, endDate } = c.req.query()

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

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY e.expense_date DESC'

    const data = await db.prepare(query).bind(...params).all()
    return c.json(data.results)
  } catch {
    return c.json({ error: 'خطأ في تحميل التقرير' }, 500)
  }
})

app.get('/salaries', auth, requireRole('manager'), async (c) => {
  try {
    const db = getDB(c.env)
    const { startDate, endDate } = c.req.query()

    let query = `
      SELECT sp.*, e.full_name as employee_name, e.position
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

    const data = await db.prepare(query).bind(...params).all()
    return c.json(data.results)
  } catch {
    return c.json({ error: 'خطأ في تحميل التقرير' }, 500)
  }
})

app.get('/end-of-day', auth, requireRole('manager'), async (c) => {
  try {
    const { startDate, endDate } = c.req.query()
    const db = getDB(c.env)
    const day = startDate && endDate ? `${startDate} - ${endDate}` : startDate || new Date().toISOString().split('T')[0]

    const settings = await db.prepare('SELECT restaurant_name, logo_url FROM settings WHERE id = 1').first<any>()
    const restaurantName = settings?.restaurant_name || 'مطعم'
    const logoUrl = settings?.logo_url || ''

    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); const nextDay = tomorrow.toISOString().split('T')[0]
    const params: (string | number)[] = []
    let where = ''
    if (startDate && endDate) {
      where = 'o.created_at >= ? AND o.created_at <= ?'
      params.push(startDate, endDate + ' 23:59:59')
    } else if (startDate) {
      where = 'o.created_at >= ? AND o.created_at < ?'
      params.push(startDate, nextDay)
    } else {
      where = 'o.created_at >= ? AND o.created_at < ?'
      params.push(today, nextDay)
    }

    const ew = where.replaceAll('o.', 'e.').replaceAll('created_at', 'expense_date')
    const sw = where.replaceAll('o.', 'sp.').replaceAll('created_at', 'paid_date')

    const r1 = await db.prepare(`SELECT COUNT(*) as order_count, COALESCE(SUM(grand_total),0) as total_sales, COALESCE(SUM(subtotal),0) as subtotal, COALESCE(SUM(service_amount),0) as service_amount, COALESCE(SUM(tax_amount),0) as tax_amount, COALESCE(SUM(discount_amount),0) as discount_amount FROM orders o WHERE ${where} AND voided=0`).bind(...params).first<any>()
    const r2 = await db.prepare(`SELECT COUNT(*) as void_count, COALESCE(SUM(grand_total),0) as voided_total FROM orders o WHERE ${where} AND voided=1`).bind(...params).first<any>()
    const r3 = await db.prepare(`SELECT COALESCE(SUM(amount),0) as total_expenses FROM expenses e WHERE ${ew}`).bind(...params).first<any>()
    const r4 = await db.prepare(`SELECT COALESCE(SUM(amount),0) as total_salaries FROM salary_payments sp WHERE ${sw}`).bind(...params).first<any>()
    const r5 = await db.prepare(`SELECT payment_method, COUNT(*) as count, SUM(grand_total) as total FROM orders o WHERE ${where} AND voided=0 GROUP BY payment_method`).bind(...params).all()
    const r6 = await db.prepare(`SELECT oi.item_name_snapshot as name, SUM(oi.quantity) as qty, SUM(oi.subtotal) as total FROM order_items oi JOIN orders o ON oi.order_id=o.id WHERE ${where} AND o.voided=0 GROUP BY oi.item_name_snapshot ORDER BY qty DESC LIMIT 10`).bind(...params).all()
    const r7 = await db.prepare(`SELECT o.id, o.customer_name, o.customer_phone, o.payment_method, o.grand_total, o.created_at, u.full_name as created_by_name FROM orders o LEFT JOIN users u ON o.created_by=u.id WHERE ${where} ORDER BY o.created_at DESC LIMIT 20`).bind(...params).all()

    return c.json({
      date: day,
      restaurantName,
      logoUrl,
      sales: {
        orderCount: r1?.order_count||0,
        totalSales: r1?.total_sales||0,
        subtotal: r1?.subtotal||0,
        serviceAmount: r1?.service_amount||0,
        taxAmount: r1?.tax_amount||0,
        discountAmount: r1?.discount_amount||0,
      },
      voided: { count: r2?.void_count||0, total: r2?.voided_total||0 },
      expenses: r3?.total_expenses||0,
      salaries: r4?.total_salaries||0,
      netProfit: (r1?.total_sales||0) - (r3?.total_expenses||0) - (r4?.total_salaries||0),
      paymentMethods: r5.results,
      topItems: r6.results,
      recentOrders: r7.results,
    })
  } catch {
    return c.json({ error: 'خطأ في تحميل التقرير' }, 500)
  }
})

app.get('/customers', auth, requireRole('manager'), async (c) => {
  try {
    const db = getDB(c.env)
    const { startDate, endDate } = c.req.query()
    let query = `SELECT DISTINCT customer_name, customer_phone FROM orders WHERE customer_name != ''`
    const params: any[] = []
    if (startDate) { query += ' AND created_at >= ?'; params.push(startDate) }
    if (endDate) { query += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59') }
    query += ' ORDER BY customer_name'
    const data = await db.prepare(query).bind(...params).all()
    return c.json(data.results)
  } catch {
    return c.json({ error: 'خطأ في تحميل التقرير' }, 500)
  }
})

export default app
