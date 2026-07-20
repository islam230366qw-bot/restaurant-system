import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'
import { Pencil, Trash2, Download, Printer } from 'lucide-react'
import Papa from 'papaparse'
import { formatDate, toArabicDigits, toApiDate } from '../lib/format'
import DateField from '../components/DateField'

type Tab = 'expenses' | 'employees' | 'salaries' | 'profit'

export default function Accounting() {
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [loading, setLoading] = useState(true)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'expenses', label: 'المصاريف' },
    { key: 'employees', label: 'الموظفين' },
    { key: 'salaries', label: 'صرف رواتب' },
    { key: 'profit', label: 'صافي الربح' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">الإدارة</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'expenses' && <ExpensesTab />}
      {activeTab === 'employees' && <EmployeesTab />}
      {activeTab === 'salaries' && <SalariesTab />}
      {activeTab === 'profit' && <ProfitTab />}
    </div>
  )
}

function ExpensesTab() {
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [form, setForm] = useState({ category: '', amount: '', expenseDate: '', description: '' })

  const categories = ['إيجار', 'فواتير', 'خامات', 'صيانة', 'أخرى']

  useEffect(() => { loadExpenses() }, [])

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const data = await api.expenses.getAll({
        category: filterCategory || undefined,
        startDate: startDate ? toApiDate(startDate) : undefined,
        endDate: endDate ? toApiDate(endDate) : undefined,
      }) as any
      setExpenses(Array.isArray(data) ? data : (data as any).data || [])
    } catch { }
    finally { setLoading(false) }
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ category: categories[0], amount: '', expenseDate: formatDate(new Date().toISOString()), description: '' })
    setShowForm(true)
  }

  const openEdit = (exp: any) => {
    setEditing(exp)
    setForm({ category: exp.category, amount: exp.amount.toString(), expenseDate: formatDate(exp.expense_date), description: exp.description || '' })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { category: form.category, amount: parseFloat(form.amount), expenseDate: toApiDate(form.expenseDate), description: form.description || undefined }
      if (editing) {
        await api.expenses.update(editing.id, data)
      } else {
        await api.expenses.create(data)
      }
      setShowForm(false)
      loadExpenses()
    } catch (err: any) { toast(err.message, 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return
    try {
      await api.expenses.delete(id)
      loadExpenses()
    } catch (err: any) { toast(err.message, 'error') }
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <select className="input-field w-auto" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">كل التصنيفات</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <DateField value={startDate} onChange={setStartDate} className="w-auto" />
          <DateField value={endDate} onChange={setEndDate} className="w-auto" />
          <button onClick={loadExpenses} className="btn-secondary text-sm">بحث</button>
        </div>
        <button onClick={openAdd} className="btn-primary">+ إضافة مصروف</button>
      </div>

      {expenses.length > 0 && (
        <p className="text-lg font-bold text-green-700 mb-4">الإجمالي: {total.toFixed(2)} ج.م</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-xl shadow-md">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-right p-3">التصنيف</th>
              <th className="text-right p-3">المبلغ</th>
              <th className="text-right p-3">التاريخ</th>
              <th className="text-right p-3">الوصف</th>
              <th className="text-left p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{exp.category}</td>
                <td className="p-3 font-bold">{exp.amount.toFixed(2)} ج.م</td>
                <td className="p-3">{formatDate(exp.expense_date)}</td>
                <td className="p-3 text-gray-500 text-sm">{exp.description || '-'}</td>
                <td className="p-3 text-left">
                  <button onClick={() => openEdit(exp)} className="text-blue-600 hover:text-blue-800 p-1" title="تعديل"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(exp.id)} className="text-red-600 hover:text-red-800 p-1" title="حذف"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={5} className="text-center p-8 text-gray-400">لا توجد مصاريف</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editing ? 'تعديل مصروف' : 'إضافة مصروف'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">التصنيف</label>
                <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">المبلغ (ج.م)</label>
                <input type="number" step="0.01" className="input-field" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">التاريخ</label>
                <DateField value={form.expenseDate} onChange={(v: string) => setForm({ ...form, expenseDate: v })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الوصف</label>
                <textarea className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'جاري الحفظ...' : (editing ? 'حفظ' : 'إضافة')}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function EmployeesTab() {
  const { toast } = useToast()
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ fullName: '', position: '', monthlySalary: '', hireDate: '' })

  useEffect(() => { loadEmployees() }, [])

  const loadEmployees = async () => {
    setLoading(true)
      try { const emps = await api.employees.getAll() as any; setEmployees(Array.isArray(emps) ? emps : (emps as any).data || []) }
      catch { }
    finally { setLoading(false) }
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ fullName: '', position: '', monthlySalary: '', hireDate: '' })
    setShowForm(true)
  }

  const openEdit = (emp: any) => {
    setEditing(emp)
    setForm({ fullName: emp.full_name, position: emp.position || '', monthlySalary: emp.monthly_salary.toString(), hireDate: emp.hire_date ? formatDate(emp.hire_date) : '' })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { fullName: form.fullName, position: form.position || undefined, monthlySalary: parseFloat(form.monthlySalary), hireDate: form.hireDate ? toApiDate(form.hireDate) : undefined }
      if (editing) {
        await api.employees.update(editing.id, { ...data, isActive: editing.is_active })
      } else {
        await api.employees.create(data)
      }
      setShowForm(false)
      loadEmployees()
    } catch (err: any) { toast(err.message, 'error') }
    finally { setSaving(false) }
  }

  const handleToggleActive = async (emp: any) => {
    try {
      await api.employees.update(emp.id, {
        fullName: emp.full_name,
        position: emp.position,
        monthlySalary: emp.monthly_salary,
        hireDate: emp.hire_date ? toApiDate(emp.hire_date) : undefined,
        isActive: !emp.is_active,
      })
      loadEmployees()
    } catch (err: any) { toast(err.message, 'error') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) return
    try {
      await api.employees.delete(id)
      loadEmployees()
    } catch (err: any) { toast(err.message, 'error') }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-500">إدارة قائمة الموظفين</p>
        <button onClick={openAdd} className="btn-primary">+ إضافة موظف</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-xl shadow-md">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-right p-3">الاسم</th>
              <th className="text-right p-3">المنصب</th>
              <th className="text-right p-3">الراتب الشهري</th>
              <th className="text-right p-3">تاريخ التعيين</th>
              <th className="text-right p-3">الحالة</th>
              <th className="text-left p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className={`border-b hover:bg-gray-50 ${!emp.is_active ? 'opacity-50' : ''}`}>
                <td className="p-3 font-medium">{emp.full_name}</td>
                <td className="p-3">{emp.position || '-'}</td>
                <td className="p-3 font-bold">{emp.monthly_salary?.toFixed(2)} ج.م</td>
                <td className="p-3">{formatDate(emp.hire_date) || '-'}</td>
                <td className="p-3">
                  <button onClick={() => handleToggleActive(emp)}
                    className={`px-2 py-1 rounded text-xs ${emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {emp.is_active ? 'نشط' : 'غير نشط'}
                  </button>
                </td>
                <td className="p-3 text-left">
                  <button onClick={() => openEdit(emp)} className="text-blue-600 hover:text-blue-800 p-1" title="تعديل"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800 p-1" title="حذف"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan={6} className="text-center p-8 text-gray-400">لا يوجد موظفون</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editing ? 'تعديل موظف' : 'إضافة موظف'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">الاسم الكامل</label>
                <input className="input-field" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">المنصب</label>
                <input className="input-field" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الراتب الشهري (ج.م)</label>
                <input type="number" step="0.01" className="input-field" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تاريخ التعيين</label>
                <DateField value={form.hireDate} onChange={(v: string) => setForm({ ...form, hireDate: v })} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'جاري الحفظ...' : (editing ? 'حفظ' : 'إضافة')}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function SalariesTab() {
  const { toast } = useToast()
  const [payments, setPayments] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ employeeId: '', amount: '', payMonth: '', paidDate: '', notes: '' })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [paysRes, empsRes] = await Promise.all([
        api.salaryPayments.getAll(),
        api.employees.getAll(),
      ]) as any
      setPayments(Array.isArray(paysRes) ? paysRes : paysRes.data || [])
      const empArr = Array.isArray(empsRes) ? empsRes : empsRes.data || []
      setEmployees(empArr.filter((e: any) => e.is_active))
    } catch { }
    finally { setLoading(false) }
  }

  const openAdd = () => {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setForm({
      employeeId: employees[0]?.id?.toString() || '',
      amount: '',
      payMonth: month,
      paidDate: formatDate(now.toISOString()),
      notes: '',
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.salaryPayments.create({
        employeeId: parseInt(form.employeeId),
        amount: parseFloat(form.amount),
        payMonth: form.payMonth,
        paidDate: form.paidDate ? toApiDate(form.paidDate) : undefined,
        notes: form.notes || undefined,
      })
      setShowForm(false)
      loadData()
    } catch (err: any) { toast(err.message, 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-500">سجل صرف الرواتب</p>
        <button onClick={openAdd} className="btn-primary">+ صرف راتب</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-xl shadow-md">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-right p-3">الموظف</th>
              <th className="text-right p-3">المبلغ</th>
              <th className="text-right p-3">الشهر</th>
              <th className="text-right p-3">تاريخ الصرف</th>
              <th className="text-right p-3">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{p.employee_name}</td>
                <td className="p-3 font-bold text-green-700">{p.amount?.toFixed(2)} ج.م</td>
                <td className="p-3">{toArabicDigits(p.pay_month)}</td>
                <td className="p-3">{formatDate(p.paid_date) || '-'}</td>
                <td className="p-3 text-gray-500 text-sm">{p.notes || '-'}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={5} className="text-center p-8 text-gray-400">لا توجد مدفوعات</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">صرف راتب</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">الموظف</label>
                <select className="input-field" value={form.employeeId} onChange={(e) => {
                  const emp = employees.find((e: any) => e.id === parseInt(e.target.value))
                  setForm({ ...form, employeeId: e.target.value, amount: emp ? emp.monthly_salary.toString() : '' })
                }}>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} - {emp.monthly_salary} ج.م</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">المبلغ (ج.م)</label>
                <input type="number" step="0.01" className="input-field" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} max={(() => { const emp = employees.find((e: any) => e.id === parseInt(form.employeeId)); return emp?.monthly_salary || '' })()} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الشهر (YYYY-MM)</label>
                <input type="text" className="input-field text-center" value={form.payMonth} onChange={(e) => setForm({ ...form, payMonth: e.target.value })} placeholder="YYYY-MM" dir="ltr" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تاريخ الصرف</label>
                <DateField value={form.paidDate} onChange={(v: string) => setForm({ ...form, paidDate: v })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ملاحظات</label>
                <textarea className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'جاري الصرف...' : 'صرف الراتب'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfitTab() {
  const { toast } = useToast()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [profitData, setProfitData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    try {
      const data = await api.profit.get(toApiDate(startDate), toApiDate(endDate))
      setProfitData(data)
    } catch (err: any) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  const handleExportCsv = () => {
    if (!profitData) return
    const rows: string[][] = [
      ['تقرير صافي الربح', '', ''],
      ['من تاريخ', startDate, ''],
      ['إلى تاريخ', endDate, ''],
      ['', '', ''],
      ['البيان', 'القيمة', 'ملاحظات'],
      ['إجمالي المبيعات', toArabicDigits(profitData.totalSales?.toFixed(2) || '0') + ' ج.م', ''],
      ['إجمالي المصاريف', toArabicDigits(profitData.totalExpenses?.toFixed(2) || '0') + ' ج.م', ''],
      ['إجمالي الرواتب', toArabicDigits(profitData.totalSalaries?.toFixed(2) || '0') + ' ج.م', ''],
      ['صافي الربح', toArabicDigits(profitData.netProfit?.toFixed(2) || '0') + ' ج.م', ''],
    ]
    const csv = Papa.unparse(rows)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `صافي_الربح_${startDate.replace(/\//g, '-')}_${endDate.replace(/\//g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handlePrint = () => {
    if (!profitData) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html dir="rtl"><head><meta charset="utf-8"><title>تقرير صافي الربح</title>
      <style>
        body{font-family:Cairo,sans-serif;padding:40px;max-width:600px;margin:auto}
        h1{color:#16a34a;border-bottom:2px solid #16a34a;padding-bottom:10px}
        .date{color:#666;font-size:14px;margin-bottom:20px}
        .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
        .total{font-weight:bold;font-size:18px;padding:12px 0;margin-top:8px;border-top:3px solid #333}
        .negative{color:#dc2626}
        @media print{body{padding:0}}
      </style></head><body>
        <h1>تقرير صافي الربح</h1>
        <p class="date">${startDate} - ${endDate}</p>
        <div class="row"><span>إجمالي المبيعات</span><span>${toArabicDigits(profitData.totalSales?.toFixed(2) || '0')} ج.م</span></div>
        <div class="row"><span>إجمالي المصاريف</span><span>${toArabicDigits(profitData.totalExpenses?.toFixed(2) || '0')} ج.م</span></div>
        <div class="row"><span>إجمالي الرواتب</span><span>${toArabicDigits(profitData.totalSalaries?.toFixed(2) || '0')} ج.م</span></div>
        <div class="total ${profitData.netProfit < 0 ? 'negative' : ''}">
          <span>صافي الربح</span>
          <span>${toArabicDigits(profitData.netProfit?.toFixed(2) || '0')} ج.م</span>
        </div>
        <script>window.print();window.onafterprint=function(){window.close()};<\/script>
      </body></html>
    `)
    win.document.close()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-bold">صافي الربح</h2>
        {profitData && !loading && (
          <div className="flex gap-2">
            <button onClick={handlePrint} className="btn-secondary text-sm"><Printer size={16} className="inline ml-1" /> طباعة</button>
            <button onClick={handleExportCsv} className="btn-secondary text-sm"><Download size={16} className="inline ml-1" /> CSV</button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <DateField value={startDate} onChange={setStartDate} className="w-auto" />
        <DateField value={endDate} onChange={setEndDate} className="w-auto" />
        <button onClick={handleSearch} className="btn-primary">عرض</button>
      </div>

      {loading && <LoadingSpinner />}

      {profitData && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-stat">
            <p className="text-gray-500 text-sm">إجمالي المبيعات</p>
            <p className="text-xl font-bold text-green-700">{profitData.totalSales?.toFixed(2)} ج.م</p>
          </div>
          <div className="card-stat">
            <p className="text-gray-500 text-sm">إجمالي المصاريف</p>
            <p className="text-xl font-bold text-red-700">{profitData.totalExpenses?.toFixed(2)} ج.م</p>
          </div>
          <div className="card-stat">
            <p className="text-gray-500 text-sm">إجمالي الرواتب</p>
            <p className="text-xl font-bold text-yellow-700">{profitData.totalSalaries?.toFixed(2)} ج.م</p>
          </div>
          <div className="card-stat border-2 border-green-500">
            <p className="text-gray-500 text-sm">صافي الربح</p>
            <p className={`text-xl font-bold ${profitData.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {profitData.netProfit?.toFixed(2)} ج.م
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
