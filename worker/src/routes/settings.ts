import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'
import { validateStr } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/', auth, requireRole('manager', 'cashier'), async (c) => {
  const db = getDB(c.env)
  const settings = await db.prepare('SELECT * FROM settings WHERE id = 1').first()
  return c.json(settings || {})
})

app.put('/', auth, requireRole('manager'), async (c) => {
  const body = await c.req.json()
  const db = getDB(c.env)

  const {
    restaurantName,
    restaurantNameEn,
    logoUrl,
    address,
    phone,
    whatsapp,
    workingHoursFrom,
    workingHoursTo,
    taxPercentage,
    serviceChargePercentage,
    chargeBase,
    paymentMethods,
  } = body

  await db.prepare(`
    UPDATE settings SET
      restaurant_name = ?, restaurant_name_en = ?, logo_url = ?,
      address = ?, phone = ?, whatsapp = ?,
      working_hours_from = ?, working_hours_to = ?,
      tax_percentage = ?, service_charge_percentage = ?,
      charge_base = ?, payment_methods = ?
    WHERE id = 1
  `  ).bind(
    validateStr(restaurantName || null, 200),
    validateStr(restaurantNameEn || null, 200),
    logoUrl || null,
    validateStr(address || null, 300),
    validateStr(phone || null, 30),
    validateStr(whatsapp || null, 30),
    validateStr(workingHoursFrom || null, 10),
    validateStr(workingHoursTo || null, 10),
    taxPercentage !== undefined ? taxPercentage : 0,
    serviceChargePercentage !== undefined ? serviceChargePercentage : 0,
    chargeBase || 'before_tax',
    paymentMethods || 'cash'
  ).run()

  return c.json({ message: 'تم حفظ الإعدادات بنجاح' })
})

app.get('/subscription', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const settings = await db.prepare(
    'SELECT trial_mode, trial_until, subscription_status, subscription_expires_at FROM settings WHERE id = 1'
  ).first()
  return c.json(settings || { trial_mode: 0, subscription_status: 'active' })
})

app.post('/subscription/extend', auth, requireRole('manager'), async (c) => {
  const { months, trialMode, trialUntil } = await c.req.json()
  const db = getDB(c.env)

  if (months) {
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + months)
    await db.prepare(
      "UPDATE settings SET subscription_status = 'active', subscription_expires_at = ?, trial_mode = 0 WHERE id = 1"
    ).bind(expiresAt.toISOString()).run()
  }

  if (trialMode !== undefined) {
    await db.prepare(
      'UPDATE settings SET trial_mode = ? WHERE id = 1'
    ).bind(trialMode ? 1 : 0).run()
  }

  if (trialUntil) {
    await db.prepare(
      'UPDATE settings SET trial_until = ? WHERE id = 1'
    ).bind(trialUntil).run()
  }

  return c.json({ message: 'تم تحديث الاشتراك' })
})

export default app
