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
  }[] = []

  for (const item of items) {
    const menuItem = await db.prepare(
      'SELECT id, name, price FROM menu_items WHERE id = ? AND is_available = 1'
    ).bind(item.menuItemId).first<{ id: number; name: string; price: number }>()

    if (!menuItem) {
      return c.json({ error: `الصنف رقم ${item.menuItemId} غير موجود أو غير متاح` }, 400)
    }

    const quantity = item.quantity || 1
    let unitPrice = menuItem.price

    if (item.optionName) {
      const optionData = await db.prepare(
        'SELECT options FROM menu_items WHERE id = ?'
      ).bind(item.menuItemId).first<{ options: string }>()

      if (optionData && optionData.options) {
        const options = JSON.parse(optionData.options)
        const selectedOption = options.find((o: { name: string }) => o.name === item.optionName)
        if (selectedOption && selectedOption.price) {
          unitPrice = selectedOption.price
        }
      }
    }

    const itemSubtotal = unitPrice * quantity
    subtotal += itemSubtotal

    orderItemsData.push({
      menuItemId: menuItem.id,
      itemNameSnapshot: menuItem.name,
      unitPriceSnapshot: unitPrice,
      quantity,
      subtotal: itemSubtotal,
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
      if (coupon.max_uses > 0) {
        const updateResult = await db.prepare(
          'UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND used_count < max_uses'
        ).bind(coupon.id).run()
        if (updateResult.meta.changes === 0) {
          return c.json({ error: 'الكوبون وصل للحد الأقصى من الاستخدامات' }, 400)
        }
      } else {
        await db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').bind(coupon.id).run()
      }
      appliedCouponCode = couponCode.toUpperCase()
      discountType = coupon.discount_type
      discountAmount = coupon.discount_type === 'percentage'
        ? grandTotal * (coupon.discount_value / 100)
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

  const batchStmts: D1PreparedStatement[] = []
  for (const itemData of orderItemsData) {
    batchStmts.push(
      db.prepare(
        `INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        orderId,
        itemData.menuItemId,
        itemData.itemNameSnapshot,
        itemData.unitPriceSnapshot,
        itemData.quantity,
        itemData.subtotal
      )
    )

    const menuItem = await db.prepare('SELECT inventory_item_id FROM menu_items WHERE id = ?').bind(itemData.menuItemId).first<{ inventory_item_id: number | null }>()
    if (menuItem?.inventory_item_id) {
      const inv = await db.prepare('SELECT id, quantity FROM inventory WHERE id = ?').bind(menuItem.inventory_item_id).first<{ id: number; quantity: number }>()
      if (inv) {
        const totalNeeded = itemData.quantity
        batchStmts.push(
          db.prepare('UPDATE inventory SET quantity = quantity - ?, updated_at = datetime(\'now\') WHERE id = ?').bind(totalNeeded, menuItem.inventory_item_id)
        )
        batchStmts.push(
          db.prepare(
            'INSERT INTO inventory_log (item_id, change_type, quantity_change, quantity_before, quantity_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(menuItem.inventory_item_id, 'remove', totalNeeded, inv.quantity, inv.quantity - totalNeeded, `خصم تلقائي للطلب #${orderId}`, userId)
        )
      }
    }
  }

  if (batchStmts.length > 0) {
    const batchResults = await db.batch(batchStmts)
    const someFailed = batchResults.some((r: any) => r.error)
    if (someFailed) {
      return c.json({ error: 'فشل في حفظ تفاصيل الطلب. تم إلغاء العملية.' }, 500)
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

  await db.prepare('UPDATE orders SET voided = 1, void_reason = \'ملغي يدويا\' WHERE id = ?').bind(id).run()

  const items = await db.prepare('SELECT menu_item_id, quantity FROM order_items WHERE order_id = ?').bind(id).all()
  const userId = c.get('userId') as number
  for (const item of items.results as any[]) {
    const menuItem = await db.prepare('SELECT inventory_item_id FROM menu_items WHERE id = ?').bind(item.menu_item_id).first<{ inventory_item_id: number | null }>()
    if (menuItem?.inventory_item_id) {
      const inv = await db.prepare('SELECT id, quantity, name FROM inventory WHERE id = ?').bind(menuItem.inventory_item_id).first<{ id: number; quantity: number; name: string }>()
      if (inv) {
        await db.prepare('UPDATE inventory SET quantity = quantity + ?, updated_at = datetime(\'now\') WHERE id = ?').bind(item.quantity, menuItem.inventory_item_id).run()
        await db.prepare(
          'INSERT INTO inventory_log (item_id, change_type, quantity_change, quantity_before, quantity_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(menuItem.inventory_item_id, 'add', item.quantity, inv.quantity, inv.quantity + item.quantity, `إعادة مخزون من الطلب الملغي #${id}`, userId).run()
      }
    }
  }

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
