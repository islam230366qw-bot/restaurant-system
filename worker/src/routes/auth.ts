import { Hono } from 'hono'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'

const app = new Hono<{ Bindings: Env }>()

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

function validatePassword(pw: string): string | null {
  if (pw.length < 10) return 'كلمة المرور يجب أن تكون 10 أحرف على الأقل'
  if (!/[A-Z]/.test(pw)) return 'كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل'
  if (!/[a-z]/.test(pw)) return 'كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل'
  if (!/[0-9]/.test(pw)) return 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل'
  return null
}

function validateUsername(u: string): string | null {
  if (u.length < 3) return 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'
  if (u.length > 50) return 'اسم المستخدم طويل جداً'
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام و _ فقط'
  return null
}

function validateFullName(n: string): string | null {
  if (n.length < 2) return 'الاسم يجب أن يكون حرفين على الأقل'
  if (n.length > 100) return 'الاسم طويل جداً'
  return null
}

async function signAccessToken(user: { id: number; role: string; full_name: string; username: string }, secret: Uint8Array): Promise<string> {
  return await new SignJWT({
    userId: user.id,
    role: user.role,
    fullName: user.full_name,
    username: user.username,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(secret)
}

async function signRefreshToken(userId: number, jti: string, secret: Uint8Array): Promise<string> {
  return await new SignJWT({
    userId,
    jti,
    purpose: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

app.post('/login', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return c.json({ error: 'محاولات كثيرة جداً. حاول بعد دقيقة' }, 429)
  }

  const { username, password } = await c.req.json()
  if (!username || !password) {
    return c.json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' }, 400)
  }

  const db = getDB(c.env)
  const user = await db.prepare(
    'SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = ?'
  ).bind(username).first<{ id: number; username: string; password_hash: string; full_name: string; role: string; is_active: number }>()

  if (!user || !user.is_active) {
    return c.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, 401)
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return c.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, 401)
  }

  const existing = await db.prepare('SELECT current_jti FROM users WHERE id = ?').bind(user.id).first<{ current_jti: string | null }>()
  if (existing?.current_jti) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await db.prepare(
      'INSERT OR IGNORE INTO token_blacklist (jti, token_type, expires_at) VALUES (?, ?, ?)'
    ).bind(existing.current_jti, 'refresh', expiresAt).run()
  }

  const secret = new TextEncoder().encode(c.env.JWT_SECRET)
  const accessToken = await signAccessToken(user, secret)

  const jti = crypto.randomUUID()
  const refreshToken = await signRefreshToken(user.id, jti, secret)

  await db.prepare('UPDATE users SET current_jti = ? WHERE id = ?').bind(jti, user.id).run()

  c.header('Set-Cookie', `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=None; Path=/api/auth; Max-Age=${7 * 24 * 60 * 60}; Partitioned`)

  return c.json({
    token: accessToken,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
    },
  })
})

app.get('/me', auth, async (c) => {
  const userId = c.get('userId')
  const db = getDB(c.env)
  const user = await db.prepare(
    'SELECT id, username, full_name, role FROM users WHERE id = ?'
  ).bind(userId).first<{ id: number; username: string; full_name: string; role: string }>()

  if (!user) {
    return c.json({ error: 'المستخدم غير موجود' }, 404)
  }

  return c.json({
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
  })
})

app.post('/refresh', async (c) => {
  const cookie = c.req.header('Cookie') || ''
  const match = cookie.match(/refresh_token=([^;]+)/)
  if (!match) {
    return c.json({ error: 'غير مصرح به' }, 401)
  }

  const refreshToken = decodeURIComponent(match[1])
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(refreshToken, secret)

    if (payload.purpose !== 'refresh') {
      return c.json({ error: 'غير مصرح به' }, 401)
    }

    const userId = payload.userId as number
    const jti = payload.jti as string

    const db = getDB(c.env)
    const blacklisted = await db.prepare(
      "SELECT id FROM token_blacklist WHERE jti = ? AND expires_at > datetime('now')"
    ).bind(jti).first()

    if (blacklisted) {
      return c.json({ error: 'غير مصرح به' }, 401)
    }

    const user = await db.prepare(
      'SELECT id, username, full_name, role FROM users WHERE id = ?'
    ).bind(userId).first<{ id: number; username: string; full_name: string; role: string }>()

    if (!user) {
      return c.json({ error: 'المستخدم غير موجود' }, 404)
    }

    const accessToken = await signAccessToken(user, secret)

    return c.json({
      token: accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
    })
  } catch {
    return c.json({ error: 'غير مصرح به' }, 401)
  }
})

app.post('/logout', auth, async (c) => {
  const jti = c.get('jti') as string | null

  if (jti) {
    const db = getDB(c.env)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await db.prepare(
      'INSERT OR IGNORE INTO token_blacklist (jti, token_type, expires_at) VALUES (?, ?, ?)'
    ).bind(jti, 'access', expiresAt).run()
  }

  const cookie = c.req.header('Cookie') || ''
  const match = cookie.match(/refresh_token=([^;]+)/)
  if (match) {
    const db = getDB(c.env)
    try {
      const secret = new TextEncoder().encode(c.env.JWT_SECRET)
      const { payload } = await jwtVerify(decodeURIComponent(match[1]), secret)
      const refreshJti = payload.jti as string
      if (refreshJti) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        await db.prepare(
          'INSERT OR IGNORE INTO token_blacklist (jti, token_type, expires_at) VALUES (?, ?, ?)'
        ).bind(refreshJti, 'refresh', expiresAt).run()
      }
    } catch {}
  }

  c.header('Set-Cookie', 'refresh_token=; HttpOnly; Secure; SameSite=None; Path=/api/auth; Max-Age=0; Partitioned')
  return c.json({ message: 'تم تسجيل الخروج' })
})

app.post('/register', auth, requireRole('manager'), async (c) => {
  const { username, password, fullName, role } = await c.req.json()
  if (!username || !password || !fullName || !role) {
    return c.json({ error: 'جميع الحقول مطلوبة' }, 400)
  }

  if (role !== 'manager' && role !== 'cashier') {
    return c.json({ error: 'الدور غير صالح' }, 400)
  }

  const usernameErr = validateUsername(username)
  if (usernameErr) return c.json({ error: usernameErr }, 400)

  const pwErr = validatePassword(password)
  if (pwErr) return c.json({ error: pwErr }, 400)

  const nameErr = validateFullName(fullName)
  if (nameErr) return c.json({ error: nameErr }, 400)

  const db = getDB(c.env)
  const existing = await db.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).bind(username).first()

  if (existing) {
    return c.json({ error: 'اسم المستخدم موجود بالفعل' }, 409)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
  ).bind(username, passwordHash, fullName, role).run()

  return c.json({ message: 'تم إنشاء المستخدم بنجاح' }, 201)
})

app.post('/register-cashier', auth, requireRole('manager'), async (c) => {
  const { username, password, fullName } = await c.req.json()
  if (!username || !password || !fullName) {
    return c.json({ error: 'جميع الحقول مطلوبة' }, 400)
  }

  const usernameErr = validateUsername(username)
  if (usernameErr) return c.json({ error: usernameErr }, 400)

  const pwErr = validatePassword(password)
  if (pwErr) return c.json({ error: pwErr }, 400)

  const nameErr = validateFullName(fullName)
  if (nameErr) return c.json({ error: nameErr }, 400)

  const db = getDB(c.env)
  const existing = await db.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).bind(username).first()

  if (existing) {
    return c.json({ error: 'اسم المستخدم موجود بالفعل' }, 409)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, 0)'
  ).bind(username, passwordHash, fullName, 'cashier').run()

  return c.json({ message: 'تم إنشاء الحساب. ينتظر موافقة المدير.' }, 201)
})

app.get('/users', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const users = await db.prepare(
    'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
  ).all()

  return c.json(users.results)
})

app.patch('/users/:id/toggle-active', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!id || isNaN(id)) return c.json({ error: 'معرف غير صالح' }, 400)
  const db = getDB(c.env)

  const user = await db.prepare('SELECT id, is_active, full_name, role FROM users WHERE id = ?').bind(id).first<{ id: number; is_active: number; full_name: string; role: string }>()
  if (!user) {
    return c.json({ error: 'المستخدم غير موجود' }, 404)
  }

  await db.prepare('UPDATE users SET is_active = ? WHERE id = ?')
    .bind(user.is_active ? 0 : 1, id).run()

  if (!user.is_active && user.role === 'cashier') {
    const existing = await db.prepare('SELECT id FROM employees WHERE full_name = ?').bind(user.full_name).first()
    if (!existing) {
      await db.prepare(
        'INSERT INTO employees (full_name, position, monthly_salary, hire_date, is_active) VALUES (?, ?, ?, ?, 1)'
      ).bind(user.full_name, 'كاشير', 0, new Date().toISOString().split('T')[0]).run()
    }
  }

  return c.json({ message: 'تم تحديث حالة المستخدم' })
})

export default app
