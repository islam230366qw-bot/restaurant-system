import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'
import { Clock, CheckCircle, Pencil, Trash2 } from 'lucide-react'
import { formatDate, toApiDate } from '../lib/format'
import DateField from '../components/DateField'

export default function Settings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [users, setUsers] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'settings' | 'users' | 'coupons'>('settings')

  const [form, setForm] = useState({
    restaurantName: '',
    restaurantNameEn: '',
    logoUrl: '',
    address: '',
    phone: '',
    whatsapp: '',
    workingHoursFrom: '',
    workingHoursTo: '',
    taxPercentage: '0',
    serviceChargePercentage: '0',
    chargeBase: 'before_tax',
    paymentMethods: ['cash'],
  })

  const paymentOptions = [
    { value: 'cash', label: 'نقدي' },
    { value: 'visa', label: 'فيزا' },
    { value: 'wallet', label: 'محفظة إلكترونية' },
  ]

  useEffect(() => {
    loadSettings()
    loadUsers()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await api.settings.get()
      if (settings && settings.id) {
        setForm({
          restaurantName: settings.restaurant_name || '',
          restaurantNameEn: settings.restaurant_name_en || '',
          logoUrl: settings.logo_url || '',
          address: settings.address || '',
          phone: settings.phone || '',
          whatsapp: settings.whatsapp || '',
          workingHoursFrom: settings.working_hours_from || '',
          workingHoursTo: settings.working_hours_to || '',
          taxPercentage: settings.tax_percentage?.toString() || '0',
          serviceChargePercentage: settings.service_charge_percentage?.toString() || '0',
          chargeBase: settings.charge_base || 'before_tax',
          paymentMethods: settings.payment_methods ? (Array.isArray(settings.payment_methods) ? settings.payment_methods : String(settings.payment_methods).split(',').map((m: string) => m.trim())) : ['cash'],
        })
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const data = await api.auth.getUsers()
      setUsers(data)
    } catch {
    }
  }

  const togglePaymentMethod = (method: string) => {
    setForm({
      ...form,
      paymentMethods: form.paymentMethods.includes(method)
        ? form.paymentMethods.filter((m) => m !== method)
        : [...form.paymentMethods, method],
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      await api.settings.update({
        restaurantName: form.restaurantName || undefined,
        restaurantNameEn: form.restaurantNameEn || undefined,
        logoUrl: form.logoUrl || undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        whatsapp: form.whatsapp || undefined,
        workingHoursFrom: form.workingHoursFrom || undefined,
        workingHoursTo: form.workingHoursTo || undefined,
        taxPercentage: parseFloat(form.taxPercentage) || 0,
        serviceChargePercentage: parseFloat(form.serviceChargePercentage) || 0,
        chargeBase: form.chargeBase,
        paymentMethods: form.paymentMethods.join(','),
      })
      setMessage('تم حفظ الإعدادات بنجاح')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleUserActive = async (id: number) => {
    try {
      await api.auth.toggleUserActive(id)
      loadUsers()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const pendingUsers = users.filter((u) => !u.is_active && u.role === 'cashier')

  if (loading) return <LoadingSpinner />

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">الإعدادات</h1>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {message}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'settings' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
        >
          إعدادات المطعم
        </button>
        <button
          onClick={() => { setActiveTab('users'); loadUsers() }}
          className={`px-4 py-2 rounded-lg ${activeTab === 'users' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
        >
          إدارة المستخدمين {pendingUsers.length > 0 && `(${pendingUsers.length} معلق)`}
        </button>
        <button
          onClick={() => setActiveTab('coupons')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'coupons' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
        >
          كوبونات الخصم
        </button>
      </div>

      {activeTab === 'settings' && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-bold text-lg border-b pb-2">معلومات المطعم</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">اسم المطعم (عربي)</label>
              <input className="input-field" value={form.restaurantName} onChange={(e) => setForm({ ...form, restaurantName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">اسم المطعم (إنجليزي)</label>
              <input className="input-field" value={form.restaurantNameEn} onChange={(e) => setForm({ ...form, restaurantNameEn: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">رابط الشعار (اختياري)</label>
            <input className="input-field" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">العنوان</label>
            <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">رقم التليفون</label>
              <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">رقم الواتساب</label>
              <input className="input-field" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">مواعيد العمل (من)</label>
              <input type="time" className="input-field" value={form.workingHoursFrom} onChange={(e) => setForm({ ...form, workingHoursFrom: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">مواعيد العمل (إلى)</label>
              <input type="time" className="input-field" value={form.workingHoursTo} onChange={(e) => setForm({ ...form, workingHoursTo: e.target.value })} />
            </div>
          </div>

          <h2 className="font-bold text-lg border-b pb-2 pt-4">الإعدادات المالية</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">نسبة الضريبة (%)</label>
              <input type="number" step="0.01" min="0" max="100" className="input-field" value={form.taxPercentage} onChange={(e) => setForm({ ...form, taxPercentage: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">نسبة رسوم الخدمة (%)</label>
              <input type="number" step="0.01" min="0" max="100" className="input-field" value={form.serviceChargePercentage} onChange={(e) => setForm({ ...form, serviceChargePercentage: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">أساس حساب الرسوم</label>
            <select className="input-field" value={form.chargeBase} onChange={(e) => setForm({ ...form, chargeBase: e.target.value })}>
              <option value="before_tax">قبل الضريبة</option>
              <option value="after_tax">بعد الضريبة</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">طرق الدفع المفعّلة</label>
            <div className="flex flex-wrap gap-3">
              {paymentOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.paymentMethods.includes(option.value)}
                    onChange={() => togglePaymentMethod(option.value)}
                    className="w-4 h-4"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full py-3">
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </form>
      )}

      {activeTab === 'users' && (
        <div className="card">
          <div className="flex items-center justify-between border-b pb-2 mb-4">
            <h2 className="font-bold text-lg">إدارة المستخدمين</h2>
            <button onClick={loadUsers} className="text-sm px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">⟳ تحديث</button>
          </div>

          {pendingUsers.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-amber-700 mb-3 flex items-center gap-2"><Clock size={18} /> في انتظار الموافقة ({pendingUsers.length})</h3>
              <div className="space-y-2">
                {pendingUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <div>
                      <p className="font-medium">{u.full_name}</p>
                      <p className="text-sm text-gray-500">@{u.username} — {formatDate(u.created_at)}</p>
                    </div>
                    <button
                      onClick={() => handleToggleUserActive(u.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <CheckCircle size={18} /> موافقة
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className="font-bold text-gray-700 mb-3">جميع المستخدمين</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right p-3">الاسم</th>
                  <th className="text-right p-3">المستخدم</th>
                  <th className="text-right p-3">الدور</th>
                  <th className="text-right p-3">الحالة</th>
                  <th className="text-left p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{u.full_name}</td>
                    <td className="p-3 text-gray-500">{u.username}</td>
                    <td className="p-3">{u.role === 'manager' ? 'مدير' : 'كاشير'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="p-3 text-left">
                      {u.role === 'cashier' && (
                        <button
                          onClick={() => handleToggleUserActive(u.id)}
                          className={`px-3 py-1 rounded text-sm ${u.is_active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {u.is_active ? 'تعطيل' : 'تفعيل'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'coupons' && <CouponsTab />}
    </div>
  )
}

function CouponsTab() {
  const { toast } = useToast()
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ code: '', discountType: 'percentage', discountValue: '', minOrder: '', maxUses: '', expiresAt: '' })

  useEffect(() => { loadCoupons() }, [])

  const loadCoupons = async () => {
    setLoading(true)
    try { setCoupons(await api.coupons.getAll()) }
    catch { }
    finally { setLoading(false) }
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ code: '', discountType: 'percentage', discountValue: '', minOrder: '', maxUses: '', expiresAt: '' })
    setShowForm(true)
  }

  const openEdit = (c: any) => {
    setEditing(c)
    setForm({ code: c.code, discountType: c.discount_type, discountValue: c.discount_value.toString(), minOrder: c.min_order?.toString() || '', maxUses: c.max_uses?.toString() || '', expiresAt: c.expires_at ? formatDate(c.expires_at) : '' })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = { code: form.code, discountType: form.discountType, discountValue: parseFloat(form.discountValue), minOrder: parseFloat(form.minOrder) || 0, maxUses: parseInt(form.maxUses) || 0, expiresAt: form.expiresAt ? toApiDate(form.expiresAt) : undefined }
      if (editing) {
        await api.coupons.update(editing.id, { ...data, isActive: editing.is_active })
      } else {
        await api.coupons.create(data)
      }
      setShowForm(false)
      loadCoupons()
    } catch (err: any) { toast(err.message, 'error') }
  }

  const handleToggleActive = async (c: any) => {
    try {
      await api.coupons.update(c.id, {
        code: c.code, discountType: c.discount_type, discountValue: c.discount_value,
        minOrder: c.min_order, maxUses: c.max_uses, expiresAt: c.expires_at ? toApiDate(c.expires_at) : undefined,
        isActive: !c.is_active,
      })
      loadCoupons()
    } catch (err: any) { toast(err.message, 'error') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الكوبون؟')) return
    try {
      await api.coupons.delete(id)
      loadCoupons()
    } catch (err: any) { toast(err.message, 'error') }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b pb-2 mb-4">
        <h2 className="font-bold text-lg">كوبونات الخصم</h2>
        <button onClick={openAdd} className="btn-primary text-sm">+ إضافة كوبون</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-right p-3">الكود</th>
              <th className="text-right p-3">نوع الخصم</th>
              <th className="text-right p-3">القيمة</th>
              <th className="text-right p-3">أقل طلب</th>
              <th className="text-right p-3">الاستخدام</th>
              <th className="text-right p-3">تاريخ الانتهاء</th>
              <th className="text-right p-3">الحالة</th>
              <th className="text-left p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-bold text-green-700">{c.code}</td>
                <td className="p-3">{c.discount_type === 'percentage' ? 'نسبة %' : 'قيمة ثابتة'}</td>
                <td className="p-3">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} ج.م`}</td>
                <td className="p-3">{c.min_order ? `${c.min_order} ج.م` : '-'}</td>
                <td className="p-3">{c.used_count}/{c.max_uses || '∞'}</td>
                <td className="p-3">{c.expires_at ? formatDate(c.expires_at) : '-'}</td>
                <td className="p-3">
                  <button onClick={() => handleToggleActive(c)}
                    className={`px-2 py-1 rounded text-xs ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.is_active ? 'نشط' : 'معطل'}
                  </button>
                </td>
                <td className="p-3 text-left">
                  <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800 p-1" title="تعديل"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800 p-1" title="حذف"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr><td colSpan={8} className="text-center p-8 text-gray-400">لا يوجد كوبونات</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editing ? 'تعديل كوبون' : 'إضافة كوبون'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">كود الكوبون</label>
                <input className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="مثال: SAVE20" required dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نوع الخصم</label>
                <select className="input-field" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
                  <option value="percentage">نسبة مئوية (%)</option>
                  <option value="fixed">قيمة ثابتة (ج.م)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">قيمة الخصم</label>
                <input type="number" step="0.01" className="input-field" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">أقل قيمة طلب</label>
                  <input type="number" step="0.01" className="input-field" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">أقصى استخدام</label>
                  <input type="number" className="input-field" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="0 = غير محدود" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تاريخ الانتهاء (اختياري)</label>
                <DateField value={form.expiresAt} onChange={(v: string) => setForm({ ...form, expiresAt: v })} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{editing ? 'حفظ' : 'إضافة'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
