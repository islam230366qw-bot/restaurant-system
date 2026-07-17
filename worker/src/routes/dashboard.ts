import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'

const app = new Hono<{ Bindings: Env }>()

app.get('/summary', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const { startDate, endDate } = c.req.query()

  if (startDate && endDate) {
    const salesResult = await db.prepare(
      "SELECT COALESCE(SUM(grand_total), 0) as total FROM orders WHERE created_at >= ? AND created_at <= ? AND voided = 0"
    ).bind(startDate, endDate + ' 23:59:59').first<{ total: number }>()

    const ordersCount = await db.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE created_at >= ? AND created_at <= ? AND voided = 0"
    ).bind(startDate, endDate + ' 23:59:59').first<{ count: number }>()

    return c.json({
      totalSales: salesResult?.total || 0,
      totalOrders: ordersCount?.count || 0,
    })
  }

  const today = new Date().toISOString().split('T')[0]

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekStart = weekAgo.toISOString().split('T')[0]

  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)
  const monthStart = monthAgo.toISOString().split('T')[0]

  const todaySales = await db.prepare(
    "SELECT COALESCE(SUM(grand_total), 0) as total FROM orders WHERE date(created_at) = ? AND voided = 0"
  ).bind(today).first<{ total: number }>()

  const todayOrders = await db.prepare(
    "SELECT COUNT(*) as count FROM orders WHERE date(created_at) = ? AND voided = 0"
  ).bind(today).first<{ count: number }>()

  const weekSales = await db.prepare(
    "SELECT COALESCE(SUM(grand_total), 0) as total FROM orders WHERE date(created_at) >= ? AND voided = 0"
  ).bind(weekStart).first<{ total: number }>()

  const monthSales = await db.prepare(
    "SELECT COALESCE(SUM(grand_total), 0) as total FROM orders WHERE date(created_at) >= ? AND voided = 0"
  ).bind(monthStart).first<{ total: number }>()

  const weekOrders = await db.prepare(
    "SELECT COUNT(*) as count FROM orders WHERE date(created_at) >= ? AND voided = 0"
  ).bind(weekStart).first<{ count: number }>()

  const monthOrders = await db.prepare(
    "SELECT COUNT(*) as count FROM orders WHERE date(created_at) >= ? AND voided = 0"
  ).bind(monthStart).first<{ count: number }>()

  return c.json({
    todaySales: todaySales?.total || 0,
    todayOrders: todayOrders?.count || 0,
    weekSales: weekSales?.total || 0,
    weekOrders: weekOrders?.count || 0,
    monthSales: monthSales?.total || 0,
    monthOrders: monthOrders?.count || 0,
  })
})

app.get('/top-items', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const { startDate, endDate } = c.req.query()

  let query = `
    SELECT oi.menu_item_id, oi.item_name_snapshot,
           SUM(oi.quantity) as total_quantity,
           SUM(oi.subtotal) as total_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
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

  query += ' WHERE o.voided = 0'
  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ')
  }

  query += ' GROUP BY oi.menu_item_id, oi.item_name_snapshot ORDER BY total_quantity DESC LIMIT 5'

  const items = await db.prepare(query).bind(...params).all()
  return c.json(items.results)
})

app.get('/sales-chart', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const { startDate, endDate } = c.req.query()

  let query = `
    SELECT date(created_at) as sale_date,
           COUNT(*) as order_count,
           COALESCE(SUM(grand_total), 0) as total_sales
    FROM orders WHERE voided = 0
  `
  const params: any[] = []
  const conditions: string[] = []

  if (startDate) {
    conditions.push('created_at >= ?')
    params.push(startDate)
  }
  if (endDate) {
    conditions.push('created_at <= ?')
    params.push(endDate + ' 23:59:59')
  }

  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ')
  }

  query += ' GROUP BY date(created_at) ORDER BY sale_date'

  const chartData = await db.prepare(query).bind(...params).all()
  return c.json(chartData.results)
})

app.get('/sales-by-payment', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const { startDate, endDate } = c.req.query()
  let query = `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total FROM orders WHERE voided = 0`
  const params: any[] = []
  if (startDate) { query += ' AND created_at >= ?'; params.push(startDate) }
  if (endDate) { query += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59') }
  query += ' GROUP BY payment_method'
  const data = await db.prepare(query).bind(...params).all()
  return c.json(data.results)
})

export default app
