import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit, validateContentType, securityHeaders } from './middleware/security'
import { rateLimit } from './middleware/ratelimit'
import { autoMigrate } from './migrate'
import { requireSubscription } from './middleware/subscription'
import authRoutes from './routes/auth'
import menuRoutes from './routes/menu'
import categoriesRoutes from './routes/categories'
import ordersRoutes from './routes/orders'
import expensesRoutes from './routes/expenses'
import employeesRoutes from './routes/employees'
import salariesRoutes from './routes/salaries'
import profitRoutes from './routes/profit'
import reportsRoutes from './routes/reports'
import settingsRoutes from './routes/settings'
import dashboardRoutes from './routes/dashboard'
import couponsRoutes from './routes/coupons'
import inventoryRoutes from './routes/inventory'
import uploadRoutes from './routes/upload'

export type Env = {
  DB: D1Database
  JWT_SECRET: string
  RESTAURANT_IMAGES?: R2Bucket
}

const app = new Hono<{ Bindings: Env }>()

const ALLOWED_ORIGINS = [
  'https://restaurant-system-5vy.pages.dev',
  /^https:\/\/[a-z0-9]+\.restaurant-system-5vy\.pages\.dev$/,
  /^http:\/\/localhost(:\d+)?$/,
]

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return ''
    if (ALLOWED_ORIGINS.some((o) => typeof o === 'string' ? origin === o : o.test(origin))) return origin
    return ''
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

app.use('*', bodyLimit)
app.use('*', validateContentType)
app.use('*', securityHeaders)

app.use('/api/*', rateLimit(60, 60_000))

app.use('/api/*', async (c, next) => {
  const db = c.env.DB
  try { await db.exec('PRAGMA foreign_keys = ON') } catch (err) { console.error('PRAGMA foreign_keys error:', err) }
  await autoMigrate(c.env)
  await next()
})

const publicRoutes = ['/api/auth/login', '/api/health']
const authRefreshRoutes = ['/api/auth/refresh', '/api/auth/register', '/api/auth/register-cashier']
app.use('/api/*', async (c, next) => {
  const path = c.req.path
  if (publicRoutes.includes(path) || authRefreshRoutes.includes(path)) {
    await next()
    return
  }
  await requireSubscription(c, next)
})

app.route('/api/auth', authRoutes)
app.route('/api/menu', menuRoutes)
app.route('/api/categories', categoriesRoutes)
app.route('/api/orders', ordersRoutes)
app.route('/api/expenses', expensesRoutes)
app.route('/api/employees', employeesRoutes)
app.route('/api/salary-payments', salariesRoutes)
app.route('/api/profit', profitRoutes)
app.route('/api/reports', reportsRoutes)
app.route('/api/settings', settingsRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/coupons', couponsRoutes)
app.route('/api/inventory', inventoryRoutes)
app.route('/api/upload', uploadRoutes)

app.get('/', (c) => c.json({ status: 'running', app: 'Restaurant API', frontend: 'https://aff2ce39.restaurant-system-5vy.pages.dev' }))

app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default app
