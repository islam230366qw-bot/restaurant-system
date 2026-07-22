import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'
import { validateStr } from '../validate'

const app = new Hono<{ Bindings: Env }>()

function validateId(v: any): number | null {
  const n = parseInt(v)
  return (!isNaN(n) && n > 0) ? n : null
}

const VALID_PAYMENTS = ['cash', 'visa', 'wallet']

app.post('/', auth, requireRole('manager', 'cashier'), async (c) => {
  const body = await c.req.json()
  const { customerName, customerPhone, customerAddress, paymentMethod, items, couponCode } = body

  if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
    return c.json({ error: 'اسم العميل والعناصر مطلوبة' }, 400)
  }

  if (paymentMethod && !VALID_PAYMENTS.includes(paymentMethod)) {
    return c.json({ error: 'طريقة الدفع غير صالحة' }, 400)
  }

  const db = getDB(c.env)

  const settings = await db.prepare('SELECT * FROM settings WHERE id = 1').first<{
    tax_percentage: number
    service_charge_percentage: number
    charge_base: string
  }>()

  const taxPercent = settings?.tax_percentage || 0
  const servicePercent = settings?.service_charge_percentage || 0
  const chargeBase = settings?.charge_base || 'before_tax'

  let subtotal = 0
  const orderItemsData: {
    menuItemId: number
    itemNameSnapshot: string
    unitPriceSnapshot: number
    quantity: number
    subtotal: number
    optionNameSnapshot: string | null
  }[] = []

  for (const item of items) {
    const quantity = Math.max(1, item.quantity || 1)
    let unitPrice = item.price || 0
    let itemName = item.name || ''
    if (!itemName || !unitPrice) {
      const menuItem = await db.prepare(
        'SELECT id, name, price, options FROM menu_items WHERE id = ? AND is_available = 1'
      ).bind(item.menuItemId).first<{ id: number; name: string; price: number; options: string }>()

      if (!menuItem) {
        return c.json({ error: `الصنف رقم ${item.menuItemId} غير موجود أو غير متاح` }, 400)
      }
      itemName = menuItem.name
      unitPrice = menuItem.price

      if (item.optionName && menuItem.options) {
        const options = JSON.parse(menuItem.options)
        const selectedOption = options.find((o: { name: string }) => o.name === item.optionName)
        if (selectedOption?.price) {
          unitPrice = selectedOption.price
        }
      }
    }

    const itemSubtotal = unitPrice * quantity
    subtotal += itemSubtotal

    orderItemsData.push({
      menuItemId: item.menuItemId,
      itemNameSnapshot: itemName,
      unitPriceSnapshot: unitPrice,
      quantity,
      subtotal: itemSubtotal,
      optionNameSnapshot: item.optionName || null,
    })
  }

  let serviceAmount = 0
  let taxAmount = 0

  if (chargeBase === 'before_tax') {
    serviceAmount = subtotal * (servicePercent / 100)
    taxAmount = subtotal * (taxPercent / 100)
  } else {
    const afterService = subtotal + (subtotal * (servicePercent / 100))
    serviceAmount = subtotal * (servicePercent / 100)
    taxAmount = afterService * (taxPercent / 100)
  }

  const grandTotal = subtotal + serviceAmount + taxAmount
  const userId = c.get('userId')

  let discountAmount = 0
  let discountType = 'none'
  let appliedCouponCode: string | null = null

  if (couponCode) {
    const coupon = await db.prepare(
      'SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime(\'now\')) AND (max_uses = 0 OR used_count < max_uses)'
    ).bind(couponCode.toUpperCase()).first<{ id: number; discount_type: string; discount_value: number; min_order: number; max_uses: number; used_count: number }>()

    if (coupon && subtotal >= coupon.min_order) {
      const updateResult = await db.prepare(
        'UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND (max_uses = 0 OR used_count < max_uses)'
      ).bind(coupon.id).run()
      if (updateResult.meta.changes === 0) {
        return c.json({ error: 'الكوبون وصل للحد الأقصى من الاستخدامات' }, 400)
      }
      appliedCouponCode = couponCode.toUpperCase()
      discountType = coupon.discount_type
      discountAmount = coupon.discount_type === 'percentage'
        ? subtotal * (coupon.discount_value / 100)
        : coupon.discount_value
      if (discountAmount > grandTotal) discountAmount = grandTotal
    }
  }

  const finalGrandTotal = grandTotal - discountAmount

  const orderResult = await db.prepare(
    `INSERT INTO orders (customer_name, customer_phone, customer_address, payment_method, subtotal, service_amount, tax_amount, discount_amount, discount_type, coupon_code, grand_total, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    validateStr(customerName, 100),
    validateStr(customerPhone || '', 30),
    validateStr(customerAddress || '', 200),
    paymentMethod || 'cash',
    subtotal,
    serviceAmount,
    taxAmount,
    discountAmount,
    discountType,
    appliedCouponCode,
    finalGrandTotal,
    userId
  ).run()

  const orderId = orderResult.meta.last_row_id

  const invItemIds = [...new Set(orderItemsData.map(d => d.menuItemId))]
  const invPlaceholders = invItemIds.map(() => '?').join(',')
  const invItems = await db.prepare(
    `SELECT id as menu_id, inventory_item_id FROM menu_items WHERE id IN (${invPlaceholders}) AND inventory_item_id IS NOT NULL`
  ).bind(...invItemIds).all()
  const invMap = new Map<number, number>()
  for (const row of (invItems.results || []) as any[]) {
    invMap.set(row.menu_id, row.inventory_item_id)
  }

  const invIds = [...new Set(invMap.values())]
  const invQ = invIds.map(() => '?').join(',')
  const invData = invIds.length > 0
    ? await db.prepare(`SELECT id, quantity FROM inventory WHERE id IN (${invQ})`).bind(...invIds).all()
    : { results: [] }
  const qtyMap = new Map<number, number>()
  for (const row of (invData.results || []) as any[]) {
    qtyMap.set(row.id, row.quantity)
  }

  const batchStmts: D1PreparedStatement[] = []
  for (const itemData of orderItemsData) {
    batchStmts.push(
      db.prepare(
        `INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, subtotal, option_name_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        orderId,
        itemData.menuItemId,
        itemData.itemNameSnapshot,
        itemData.unitPriceSnapshot,
        itemData.quantity,
        itemData.subtotal,
        itemData.optionNameSnapshot
      )
    )

    const invItemId = invMap.get(itemData.menuItemId)
    if (invItemId) {
      const currentQty = qtyMap.get(invItemId) ?? 0
      const totalNeeded = itemData.quantity
      batchStmts.push(
        db.prepare(
          'UPDATE inventory SET quantity = quantity - ?, updated_at = datetime(\'now\') WHERE id = ? AND quantity >= ?'
        ).bind(totalNeeded, invItemId, totalNeeded)
      )
      batchStmts.push(
        db.prepare(
          'INSERT INTO inventory_log (item_id, change_type, quantity_change, quantity_before, quantity_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(invItemId, 'remove', totalNeeded, currentQty, Math.max(0, currentQty - totalNeeded), `خصم تلقائي للطلب #${orderId}`, userId)
      )
    }
  }

  if (batchStmts.length > 0) {
    const CHUNK_SIZE = 25
    for (let i = 0; i < batchStmts.length; i += CHUNK_SIZE) {
      const chunk = batchStmts.slice(i, i + CHUNK_SIZE)
      const batchResults = await db.batch(chunk)
      const someFailed = batchResults.some((r: any) => r.error)
      if (someFailed) {
        return c.json({ error: 'فشل في حفظ تفاصيل الطلب. تم إلغاء العملية.' }, 500)
      }
    }
  }

  return c.json({
    orderId,
    subtotal,
    serviceAmount,
    taxAmount,
    discountAmount,
    discountType,
    couponCode: appliedCouponCode,
    grandTotal: finalGrandTotal,
    message: 'تم حفظ الطلب بنجاح',
  }, 201)
})

app.get('/', auth, requireRole('manager', 'cashier'), async (c) => {
  const db = getDB(c.env)
  const { startDate, endDate, page = '1', limit = '50' } = c.req.query()
  const pageNum = Math.max(1, parseInt(page) || 1)
  const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 50))

  let query = `
    SELECT o.*, u.full_name as created_by_name
    FROM orders o
    LEFT JOIN users u ON o.created_by = u.id
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

  const offset = (pageNum - 1) * limitNum
  query += ` LIMIT ? OFFSET ?`
  params.push(limitNum, offset)

  const orders = await db.prepare(query).bind(...params).all()

  const countParams = params.slice(0, -2)
  const countQuery = `SELECT COUNT(*) as total FROM orders` +
    (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '')
  const countResult = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>()

  return c.json({
    orders: orders.results,
    total: countResult?.total || 0,
    page: pageNum,
    limit: limitNum,
  })
})

app.get('/:id', auth, requireRole('manager', 'cashier'), async (c) => {
  const id = validateId(c.req.param('id'))
  if (!id) return c.json({ error: 'معرف غير صالح' }, 400)
  const db = getDB(c.env)

  const order = await db.prepare(
    `SELECT o.*, u.full_name as created_by_name
     FROM orders o
     LEFT JOIN users u ON o.created_by = u.id
     WHERE o.id = ?`
  ).bind(id).first()

  if (!order) {
    return c.json({ error: 'الطلب غير موجود' }, 404)
  }

  const items = await db.prepare(
    'SELECT * FROM order_items WHERE order_id = ?'
  ).bind(id).all()

  return c.json({ ...order, items: items.results })
})

app.patch('/:id/void', auth, requireRole('manager'), async (c) => {
  const id = validateId(c.req.param('id'))
  if (!id) return c.json({ error: 'معرف غير صالح' }, 400)
  const db = getDB(c.env)

  const order = await db.prepare('SELECT id, voided FROM orders WHERE id = ?').bind(id).first<{ id: number; voided: number }>()
  if (!order) return c.json({ error: 'الطلب غير موجود' }, 404)
  if (order.voided) return c.json({ error: 'الطلب ملغي بالفعل' }, 400)

  const items = await db.prepare('SELECT menu_item_id, quantity FROM order_items WHERE order_id = ?').bind(id).all()
  const userId = c.get('userId') as number
  const stmts: any[] = []

  for (const item of items.results as any[]) {
    const menuItem = await db.prepare('SELECT inventory_item_id FROM menu_items WHERE id = ?').bind(item.menu_item_id).first<{ inventory_item_id: number | null }>()
    if (menuItem?.inventory_item_id) {
      const inv = await db.prepare('SELECT id, quantity, name FROM inventory WHERE id = ?').bind(menuItem.inventory_item_id).first<{ id: number; quantity: number; name: string }>()
      if (inv) {
        stmts.push(
          db.prepare('UPDATE inventory SET quantity = quantity + ?, updated_at = datetime(\'now\') WHERE id = ?').bind(item.quantity, menuItem.inventory_item_id),
          db.prepare('INSERT INTO inventory_log (item_id, change_type, quantity_change, quantity_before, quantity_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(menuItem.inventory_item_id, 'add', item.quantity, inv.quantity, inv.quantity + item.quantity, `إعادة مخزون من الطلب الملغي #${id}`, userId)
        )
      }
    }
  }

  stmts.push(db.prepare('UPDATE orders SET voided = 1, void_reason = \'ملغي يدويا\' WHERE id = ? AND voided = 0').bind(id))
  await db.batch(stmts)

  return c.json({ message: 'تم إلغاء الطلب وإعادة المخزون' })
})

app.delete('/:id', auth, requireRole('manager'), async (c) => {
  const id = validateId(c.req.param('id'))
  if (!id) return c.json({ error: 'معرف غير صالح' }, 400)
  const db = getDB(c.env)
  const order = await db.prepare('SELECT id FROM orders WHERE id = ?').bind(id).first()
  if (!order) return c.json({ error: 'الطلب غير موجود' }, 404)
  await db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(id).run()
  await db.prepare('DELETE FROM orders WHERE id = ?').bind(id).run()
  return c.json({ message: 'تم حذف الطلب' })
})

export default app
