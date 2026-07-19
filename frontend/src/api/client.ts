const API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE
  : 'https://restaurant-api.restaurant-system-api.workers.dev/api'

let accessToken: string | null = null

export function setAccessToken(t: string | null) {
  accessToken = t
}

export function getAccessToken(): string | null {
  return accessToken
}

async function request<T>(endpoint: string, options: RequestInit & { signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  if (options.body instanceof FormData) {
    delete headers['Content-Type']
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: options.signal || controller.signal,
    })

    if (response.status === 402) {
      const data = await response.json().catch(() => ({ error: 'انتهت صلاحية الاشتراك' }))
      localStorage.setItem('subscription_expired', 'true')
      window.location.href = '/subscription-expired'
      throw new Error(data.error || 'انتهت صلاحية الاشتراك')
    }

    if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
      const refreshed = await attemptRefresh()
      if (refreshed) {
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }
        const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers,
          credentials: 'include',
          signal: options.signal || controller.signal,
        })
        if (retryResponse.status === 402) {
          localStorage.setItem('subscription_expired', 'true')
          window.location.href = '/subscription-expired'
          throw new Error('انتهت صلاحية الاشتراك')
        }
        if (!retryResponse.ok) {
          const err = await retryResponse.json().catch(() => ({ error: 'حدث خطأ غير متوقع' }))
          throw new Error(err.error || `HTTP ${retryResponse.status}`)
        }
        return retryResponse.json()
      }
      window.location.href = '/login'
      throw new Error('الجلسة منتهية')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'حدث خطأ غير متوقع' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function attemptRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return false
    const data = await response.json()
    if (data.token) {
      accessToken = data.token
      return true
    }
    return false
  } catch {
    return false
  }
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; user: { id: number; username: string; fullName: string; role: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    me: () => request<{ id: number; username: string; fullName: string; role: string }>('/auth/me'),
    refresh: () => attemptRefresh(),
    logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
    register: (data: { username: string; password: string; fullName: string; role: string }) =>
      request<{ message: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    registerCashier: (data: { username: string; password: string; fullName: string }) =>
      request<{ message: string }>('/auth/register-cashier', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getUsers: () => request<any[]>('/auth/users'),
    toggleUserActive: (id: number) =>
      request<{ message: string }>(`/auth/users/${id}/toggle-active`, { method: 'PATCH' }),
  },

  menu: {
    getAll: () => request<any[]>('/menu'),
    getActive: () => request<any[]>('/menu/active'),
    create: (data: any) =>
      request<{ id: number; message: string }>('/menu', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: any) =>
      request<{ message: string }>(`/menu/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<{ message: string }>(`/menu/${id}`, { method: 'DELETE' }),
    toggleAvailability: (id: number, isAvailable: boolean) =>
      request<{ message: string }>(`/menu/${id}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable }),
      }),
    getCategories: () => request<any[]>('/categories'),
    createCategory: (data: any) =>
      request<{ id: number; message: string }>('/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateCategory: (id: number, data: any) =>
      request<{ message: string }>(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteCategory: (id: number) =>
      request<{ message: string }>(`/categories/${id}`, { method: 'DELETE' }),
  },

  orders: {
    create: (data: any) =>
      request<{ orderId: number; subtotal: number; serviceAmount: number; taxAmount: number; discountAmount: number; discountType: string; couponCode: string | null; grandTotal: number; message: string }>('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAll: (params?: { startDate?: string; endDate?: string; page?: number; limit?: number }) => {
      const query = new URLSearchParams()
      if (params?.startDate) query.set('startDate', params.startDate)
      if (params?.endDate) query.set('endDate', params.endDate)
      if (params?.page) query.set('page', String(params.page))
      if (params?.limit) query.set('limit', String(params.limit))
      return request<{ orders: any[]; total: number; page: number; limit: number }>(`/orders?${query}`)
    },
    getById: (id: number) => request<any>(`/orders/${id}`),
    void: (id: number) =>
      request<{ message: string }>(`/orders/${id}/void`, { method: 'PATCH' }),
    delete: (id: number) =>
      request<{ message: string }>(`/orders/${id}`, { method: 'DELETE' }),
  },

  expenses: {
    getAll: (params?: { startDate?: string; endDate?: string; category?: string }) => {
      const query = new URLSearchParams()
      if (params?.startDate) query.set('startDate', params.startDate)
      if (params?.endDate) query.set('endDate', params.endDate)
      if (params?.category) query.set('category', params.category)
      return request<any[]>(`/expenses?${query}`)
    },
    create: (data: any) =>
      request<{ id: number; message: string }>('/expenses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: any) =>
      request<{ message: string }>(`/expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<{ message: string }>(`/expenses/${id}`, { method: 'DELETE' }),
  },

  employees: {
    getAll: () => request<any[]>('/employees'),
    create: (data: any) =>
      request<{ id: number; message: string }>('/employees', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: any) =>
      request<{ message: string }>(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<{ message: string }>(`/employees/${id}`, { method: 'DELETE' }),
  },

  salaryPayments: {
    getAll: (params?: { startDate?: string; endDate?: string }) => {
      const query = new URLSearchParams()
      if (params?.startDate) query.set('startDate', params.startDate)
      if (params?.endDate) query.set('endDate', params.endDate)
      return request<any[]>(`/salary-payments?${query}`)
    },
    create: (data: any) =>
      request<{ id: number; message: string }>('/salary-payments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  profit: {
    get: (startDate: string, endDate: string) =>
      request<{ totalSales: number; totalExpenses: number; totalSalaries: number; netProfit: number }>(
        `/profit?startDate=${startDate}&endDate=${endDate}`
      ),
  },

  reports: {
    sales: (startDate?: string, endDate?: string) => {
      const query = new URLSearchParams()
      if (startDate) query.set('startDate', startDate)
      if (endDate) query.set('endDate', endDate)
      return request<any[]>(`/reports/sales?${query}`)
    },
    expenses: (startDate?: string, endDate?: string) => {
      const query = new URLSearchParams()
      if (startDate) query.set('startDate', startDate)
      if (endDate) query.set('endDate', endDate)
      return request<any[]>(`/reports/expenses?${query}`)
    },
    salaries: (startDate?: string, endDate?: string) => {
      const query = new URLSearchParams()
      if (startDate) query.set('startDate', startDate)
      if (endDate) query.set('endDate', endDate)
      return request<any[]>(`/reports/salaries?${query}`)
    },
    endOfDay: (startDate?: string, endDate?: string) => {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      return request<any>(`/reports/end-of-day?${params}`)
    },
    customers: (startDate?: string, endDate?: string) => {
      const query = new URLSearchParams()
      if (startDate) query.set('startDate', startDate)
      if (endDate) query.set('endDate', endDate)
      return request<any[]>(`/reports/customers?${query}`)
    },
  },

  coupons: {
    getAll: () => request<any[]>('/coupons'),
    getByCode: (code: string) => request<any>(`/coupons/${code}`),
    create: (data: any) =>
      request<{ message: string }>('/coupons', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: any) =>
      request<{ message: string }>(`/coupons/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<{ message: string }>(`/coupons/${id}`, { method: 'DELETE' }),
  },

  inventory: {
    getAll: () => request<any[]>('/inventory'),
    getById: (id: number) => request<any>(`/inventory/${id}`),
    getLowStock: () => request<any[]>('/inventory/low-stock'),
    create: (data: any) =>
      request<{ id: number; message: string }>('/inventory', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: any) =>
      request<{ message: string }>(`/inventory/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    adjust: (id: number, data: any) =>
      request<{ message: string; quantityBefore: number; quantityAfter: number }>(`/inventory/${id}/adjust`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getLog: (id: number) => request<any[]>(`/inventory/${id}/log`),
    delete: (id: number) =>
      request<{ message: string }>(`/inventory/${id}`, { method: 'DELETE' }),
  },

  settings: {
    get: () => request<any>('/settings'),
    update: (data: any) =>
      request<{ message: string }>('/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  dashboard: {
    summary: (startDate?: string, endDate?: string) => {
      const query = new URLSearchParams()
      if (startDate) query.set('startDate', startDate)
      if (endDate) query.set('endDate', endDate)
      return request<any>(`/dashboard/summary?${query}`)
    },
    topItems: (startDate?: string, endDate?: string) => {
      const query = new URLSearchParams()
      if (startDate) query.set('startDate', startDate)
      if (endDate) query.set('endDate', endDate)
      return request<any[]>(`/dashboard/top-items?${query}`)
    },
    salesChart: (startDate?: string, endDate?: string) => {
      const query = new URLSearchParams()
      if (startDate) query.set('startDate', startDate)
      if (endDate) query.set('endDate', endDate)
      return request<any[]>(`/dashboard/sales-chart?${query}`)
    },
    salesByPayment: (startDate?: string, endDate?: string) => {
      const query = new URLSearchParams()
      if (startDate) query.set('startDate', startDate)
      if (endDate) query.set('endDate', endDate)
      return request<any[]>(`/dashboard/sales-by-payment?${query}`)
    },
  },

  subscription: {
    getStatus: () => request<{ trial_mode: number; trial_until: string | null; subscription_status: string; subscription_expires_at: string | null }>('/settings/subscription'),
    extend: (months: number) => request<{ message: string }>('/settings/subscription/extend', {
      method: 'POST',
      body: JSON.stringify({ months }),
    }),
  },
}

export function getImageUrl(key: string | null | undefined): string {
  if (!key) return ''
  if (key.startsWith('http')) return key
  return key
}
