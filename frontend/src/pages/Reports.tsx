import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'
import { Printer, Download } from 'lucide-react'
import { formatDate, formatDateTime, toArabicDigits, toApiDate } from '../lib/format'
import DateField from '../components/DateField'

function esc(s: string | undefined | null): string {
  if (!s) return ''
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

function fmt(n: number | undefined | null | string, suffix = ''): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (v === undefined || v === null || isNaN(v)) return toArabicDigits(`0.00${suffix}`)
  return toArabicDigits(`${v.toFixed(2)}${suffix}`)
}

function label(role: string): string {
  if (role === 'manager') return 'مدير'
  if (role === 'cashier') return 'كاشير'
  return role
}

function payLabel(m: string): string {
  if (m === 'cash') return 'نقدي'
  if (m === 'visa') return 'فيزا'
  if (m === 'wallet') return 'محفظة'
  return m || ''
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'endofday' | 'export'>('endofday')

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">التقارير</h1>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('endofday')} className={`px-4 py-2 rounded-lg ${activeTab === 'endofday' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}>تقرير نهاية اليوم</button>
        <button onClick={() => setActiveTab('export')} className={`px-4 py-2 rounded-lg ${activeTab === 'export' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}>تصدير CSV</button>
      </div>

      {activeTab === 'endofday' && <EndOfDayReport />}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SaleReportExporter />
          <ExpenseReportExporter />
          <SalaryReportExporter />
          <OrderExporter />
          <CustomerExporter />
          <UserExporter />
        </div>
      )}
    </div>
  )
}

function EndOfDayReport() {
  const { toast } = useToast()
  const today = formatDate(new Date().toISOString())
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    if (!startDate) return
    setLoading(true)
    setError('')
    try {
      const res = await api.reports.endOfDay(toApiDate(startDate), toApiDate(endDate || startDate))
      setData(res)
    } catch (err: any) {
      setError(err.message || 'فشل تحميل التقرير')
      toast(err.message || 'فشل تحميل التقرير', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { const ac = new AbortController(); refresh(); return () => ac.abort() }, [startDate, endDate])

  const dateLabel = startDate === endDate ? startDate : `${startDate} - ${endDate}`

  const handlePrint = () => {
    if (!data) return
    const win = window.open('', '_blank')
    if (!win) return

    const methodsHtml = (data.paymentMethods || []).map((m: any) =>
      `<div class="row"><span>${payLabel(m.payment_method)}</span><span>${m.count} طلب | ${fmt(m.total)} ج.م</span></div>`
    ).join('')

    const itemsHtml = (data.topItems || []).map((i: any) =>
      `<div class="row"><span>${esc(i.name)}</span><span>${i.qty || 0} | ${fmt(i.total)} ج.م</span></div>`
    ).join('')

    const ordersRows = (data.recentOrders || []).map((o: any) =>
      `<tr><td>${o.id||''}</td><td>${esc(o.customer_name)}</td><td>${esc(o.customer_phone)}</td><td>${esc(o.customer_address)}</td><td>${payLabel(o.payment_method)}</td><td>${esc(o.created_by_name)}</td><td>${fmt(o.grand_total)}</td><td>${o.created_at?formatDate(o.created_at):''}</td></tr>`
    ).join('')

    win.document.write(`
      <html dir="rtl"><head><meta charset="utf-8"><title>تقرير نهاية اليوم</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px; font-size: 13px; }
        h1 { text-align: center; font-size: 22px; margin-bottom: 5px; }
        .date { text-align: center; color: #666; margin-bottom: 20px; }
        .section { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; padding: 15px; }
        .section h2 { font-size: 16px; margin-top: 0; border-bottom: 2px solid #333; padding-bottom: 8px; }
        .row { display: flex; justify-content: space-between; padding: 4px 0; }
        .total { font-size: 20px; font-weight: bold; color: #16a34a; text-align: center; padding: 10px; }
        .negative { color: #dc2626; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { padding: 5px 4px; text-align: right; border-bottom: 1px solid #eee; }
        @media print { body { padding: 0; } }
      </style></head><body>
        ${data.logoUrl ? `<img src="${esc(data.logoUrl)}" style="max-width:100%;height:auto;margin-bottom:6px;object-fit:contain" />` : ''}
        <h1>${esc(data.restaurantName) || ''}</h1>
        <p class="date">تقرير نهاية اليوم - ${esc(dateLabel)}</p>

        <div class="section">
          <h2>ملخص المبيعات</h2>
          <div class="row"><span>عدد الطلبات</span><span>${data.sales?.orderCount || 0}</span></div>
          <div class="row"><span>المجموع الفرعي</span><span>${fmt(data.sales?.subtotal)} ج.م</span></div>
          <div class="row"><span>رسوم خدمة</span><span>${fmt(data.sales?.serviceAmount)} ج.م</span></div>
          <div class="row"><span>ضريبة</span><span>${fmt(data.sales?.taxAmount)} ج.م</span></div>
          <div class="row" style="color:#c00"><span>الخصم</span><span>-${fmt(data.sales?.discountAmount)} ج.م</span></div>
          <div class="row" style="font-weight:bold;border-top:2px solid #333;padding-top:8px;margin-top:4px"><span>إجمالي المبيعات</span><span>${fmt(data.sales?.totalSales)} ج.م</span></div>
          ${data.voided?.count > 0 ? `<div class="row negative"><span>طلبات ملغية (${data.voided.count})</span><span>${fmt(data.voided.total)} ج.م</span></div>` : ''}
        </div>

        <div class="section"><h2>طرق الدفع</h2>${methodsHtml || '<p style="color:#999">لا توجد مدفوعات</p>'}</div>

        <div class="section">
          <h2>المصروفات والمرتبات</h2>
          <div class="row"><span>مصروفات</span><span>${fmt(data.expenses)} ج.م</span></div>
          <div class="row"><span>مرتبات</span><span>${fmt(data.salaries)} ج.م</span></div>
        </div>

        <div class="total" style="${data.netProfit < 0 ? 'color:#dc2626' : ''}">
          <div>صافي الربح</div>
          <div>${fmt(data.netProfit)} ج.م</div>
        </div>

        ${data.topItems?.length > 0 ? `<div class="section"><h2>أكثر الأصناف مبيعاً</h2>${itemsHtml}</div>` : ''}

        <div class="section">
          <h2>آخر الطلبات</h2>
          <table><thead><tr><th>#</th><th>العميل</th><th>التليفون</th><th>طريقة الدفع</th><th>الكاشير</th><th>الإجمالي</th><th>التاريخ</th></tr></thead>
          <tbody>${ordersRows || '<tr><td colspan="7" style="text-align:center;color:#999">لا توجد طلبات</td></tr>'}</tbody></table>
        </div>

        <script>window.print();window.onafterprint=function(){window.close()};<\/script>
      </body></html>
    `)
    win.document.close()
  }

  const handleExportCsv = () => {
    if (!data) return
    const rows: string[][] = []
    const push = (...cols: string[]) => rows.push(cols)
    push('تقرير نهاية اليوم', '', '')
    push('التاريخ', dateLabel, '')
    push('', '', '')
    push('البيان', 'القيمة', 'ملاحظات')
    push('عدد الطلبات', String(data.sales?.orderCount || 0), '')
    push('المجموع الفرعي', fmt(data.sales?.subtotal), 'ج.م')
    push('رسوم خدمة', fmt(data.sales?.serviceAmount), 'ج.م')
    push('ضريبة', fmt(data.sales?.taxAmount), 'ج.م')
    push('الخصم', fmt(data.sales?.discountAmount), 'ج.م')
    push('إجمالي المبيعات', fmt(data.sales?.totalSales), 'ج.م')
    push('المصروفات', fmt(data.expenses), 'ج.م')
    push('المرتبات', fmt(data.salaries), 'ج.م')
    push('صافي الربح', fmt(data.netProfit), 'ج.م')
    push('', '', '')
    if (data.voided?.count > 0) push('طلبات ملغية', String(data.voided.count), `${fmt(data.voided.total)} ج.م`)
    push('', '', '')
    push('طرق الدفع', '', '')
    ;(data.paymentMethods || []).forEach((m: any) => push(payLabel(m.payment_method), `${m.count} طلب`, `${fmt(m.total)} ج.م`))
    push('', '', '')
    push('أكثر الأصناف مبيعاً', '', '')
    ;(data.topItems || []).forEach((i: any) => push(i.name || '', `${i.qty || 0} وحدة`, `${fmt(i.total)} ج.م`))
    push('', '', '')
    push('آخر الطلبات', '', '')
    ;(data.recentOrders || []).forEach((o: any) => push(`#${o.id || ''}`, o.customer_name || '', o.customer_phone || '', o.customer_address || '', `${fmt(o.grand_total)} ج.م - ${o.created_by_name || ''}`))

    const csv = Papa.unparse(rows)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `تقرير_${dateLabel}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div>
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium mb-1">من تاريخ</label>
            <DateField value={startDate} onChange={setStartDate} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">إلى تاريخ</label>
            <DateField value={endDate} onChange={setEndDate} />
          </div>
          <button onClick={refresh} className="btn-secondary h-[42px]">⟳ تحديث</button>
          <button onClick={handlePrint} disabled={!data} className="btn-primary h-[42px]"><Printer size={18} className="inline ml-1" /> طباعة</button>
          <button onClick={handleExportCsv} disabled={!data} className="btn-secondary h-[42px]"><Download size={18} className="inline ml-1" /> CSV</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 p-4 rounded-lg mb-4 text-center font-bold">
          ⚠ {error}
        </div>)}

      {loading ? <LoadingSpinner /> : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card-stat">
              <p className="text-gray-500 text-sm">عدد الطلبات</p>
              <p className="text-2xl font-bold text-blue-700">{data.sales?.orderCount ?? 0}</p>
            </div>
            <div className="card-stat">
              <p className="text-gray-500 text-sm">إجمالي المبيعات</p>
              <p className="text-2xl font-bold text-green-700">{fmt(data.sales?.totalSales)} ج.م</p>
            </div>
            <div className="card-stat">
              <p className="text-gray-500 text-sm">المصروفات</p>
              <p className="text-2xl font-bold text-red-700">{fmt(data.expenses)} ج.م</p>
            </div>
            <div className="card-stat">
              <p className="text-gray-500 text-sm">صافي الربح</p>
              <p className={`text-2xl font-bold ${(data.netProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(data.netProfit)} ج.م</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-bold mb-3">طرق الدفع</h3>
              {(data.paymentMethods ?? []).length > 0 ? (
                <div className="space-y-2">
                  {(data.paymentMethods as any[]).map((m: any, i: number) => (
                    <div key={i} className="flex justify-between py-2 border-b text-sm">
                      <span>{payLabel(m.payment_method)}</span>
                      <span>{m.count} طلب — {fmt(m.total)} ج.م</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-400 text-sm">لا توجد مدفوعات</p>}
            </div>

            <div className="card">
              <h3 className="font-bold mb-3">أكثر الأصناف مبيعاً</h3>
              {(data.topItems ?? []).length > 0 ? (
                <div className="space-y-2">
                  {(data.topItems as any[]).map((i: any, idx: number) => (
                    <div key={idx} className="flex justify-between py-2 border-b text-sm">
                      <span>{i.name || ''}</span>
                      <span>{i.qty || 0} وحدة — {fmt(i.total)} ج.م</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-400 text-sm">لا توجد مبيعات</p>}
            </div>

            <div className="card lg:col-span-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">آخر الطلبات</h3>
                <span className="text-sm text-gray-400">{data.sales?.orderCount ?? 0} طلب</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="border-b bg-gray-50">
                      <th className="text-right p-2">#</th>
                      <th className="text-right p-2">العميل</th>
                      <th className="text-right p-2">التليفون</th>
                      <th className="text-right p-2">العنوان</th>
                      <th className="text-right p-2">طريقة الدفع</th>
                      <th className="text-right p-2">الكاشير</th>
                      <th className="text-left p-2">الإجمالي</th>
                      <th className="text-right p-2">التاريخ</th>
                    </tr></thead>
                  <tbody>
                    {(data.recentOrders ?? []).map((o: any) => (
                      <tr key={o.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{o.id ?? ''}</td>
                        <td className="p-2">{o.customer_name || ''}</td>
                        <td className="p-2">{o.customer_phone || ''}</td>
                        <td className="p-2">{o.customer_address || ''}</td>
                        <td className="p-2">{payLabel(o.payment_method)}</td>
                        <td className="p-2">{o.created_by_name || ''}</td>
                        <td className="p-2 text-left font-bold">{fmt(o.grand_total)}</td>
                        <td className="p-2 text-xs text-gray-500">{o.created_at ? formatDateTime(o.created_at) : ''}</td>
                      </tr>
                    ))}
                    {(data.recentOrders ?? []).length === 0 && (
                      <tr><td colSpan={8} className="text-center p-4 text-gray-400">لا توجد طلبات في هذا النطاق</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : !error ? (
        <div className="text-center py-8 text-gray-400">اختر التاريخ لعرض التقرير</div>
      ) : null}
    </div>
  )
}

function SaleReportExporter() {
  const { toast } = useToast()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (!startDate || !endDate) { toast('يرجى اختيار الفترة الزمنية', 'error'); return }
    setLoading(true)
    try {
      const raw = await api.reports.sales(startDate, endDate)
      const flat = raw.map((r: any) => ({
        'رقم الطلب': r.order_id,
        'العميل': r.customer_name,
        'التليفون': r.customer_phone || '',
        'العنوان': r.customer_address || '',
        'طريقة الدفع': payLabel(r.payment_method),
        'المجموع الفرعي': fmt(r.subtotal),
        'رسوم خدمة': fmt(r.service_amount),
        'ضريبة': fmt(r.tax_amount),
        'الإجمالي': fmt(r.grand_total),
        'التاريخ': r.created_at ? formatDate(r.created_at) : '',
        'الكاشير': r.created_by_name || '',
        'الصنف': r.item_name_snapshot || '',
        'الكمية': r.quantity || 0,
        'سعر الوحدة': fmt(r.unit_price_snapshot),
        'إجمالي الصنف': fmt(r.item_subtotal),
      }))
      if (!flat.length) { toast('لا توجد بيانات', 'error'); return }
      downloadCSV(flat, `مبيعات_${startDate}_${endDate}.csv`)
    } catch (err: any) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <h2 className="font-bold text-lg mb-4">تصدير المبيعات</h2>
      <div className="space-y-3">
        <div><label className="block text-sm text-gray-500 mb-1">من تاريخ</label><DateField value={startDate} onChange={setStartDate} /></div>
        <div><label className="block text-sm text-gray-500 mb-1">إلى تاريخ</label><DateField value={endDate} onChange={setEndDate} /></div>
        <button onClick={handleExport} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">{loading ? 'جاري...' : <><Download size={18} /> تصدير CSV</>}</button>
      </div>
    </div>
  )
}

function ExpenseReportExporter() {
  const { toast } = useToast()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (!startDate || !endDate) { toast('يرجى اختيار الفترة الزمنية', 'error'); return }
    setLoading(true)
    try {
      const raw = await api.reports.expenses(startDate, endDate)
      const flat = raw.map((r: any) => ({
        'التاريخ': r.expense_date ? formatDate(r.expense_date) : '',
        'التصنيف': r.category || '',
        'البيان': r.description || '',
        'المبلغ': fmt(r.amount),
        'المسجل بواسطة': r.created_by_name || '',
      }))
      if (!flat.length) { toast('لا توجد بيانات', 'error'); return }
      downloadCSV(flat, `مصاريف_${startDate}_${endDate}.csv`)
    } catch (err: any) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <h2 className="font-bold text-lg mb-4">تصدير المصاريف</h2>
      <div className="space-y-3">
        <div><label className="block text-sm text-gray-500 mb-1">من تاريخ</label><DateField value={startDate} onChange={setStartDate} /></div>
        <div><label className="block text-sm text-gray-500 mb-1">إلى تاريخ</label><DateField value={endDate} onChange={setEndDate} /></div>
        <button onClick={handleExport} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">{loading ? 'جاري...' : <><Download size={18} /> تصدير CSV</>}</button>
      </div>
    </div>
  )
}

function SalaryReportExporter() {
  const { toast } = useToast()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (!startDate || !endDate) { toast('يرجى اختيار الفترة الزمنية', 'error'); return }
    setLoading(true)
    try {
      const raw = await api.reports.salaries(startDate, endDate)
      const flat = raw.map((r: any) => ({
        'الموظف': r.employee_name || '',
        'الوظيفة': r.position || '',
        'المبلغ': fmt(r.amount),
        'شهر': r.pay_month || '',
        'تاريخ الدفع': r.paid_date ? formatDate(r.paid_date) : '',
        'ملاحظات': r.notes || '',
      }))
      if (!flat.length) { toast('لا توجد بيانات', 'error'); return }
      downloadCSV(flat, `رواتب_${startDate}_${endDate}.csv`)
    } catch (err: any) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <h2 className="font-bold text-lg mb-4">تصدير الرواتب</h2>
      <div className="space-y-3">
        <div><label className="block text-sm text-gray-500 mb-1">من تاريخ</label><DateField value={startDate} onChange={setStartDate} /></div>
        <div><label className="block text-sm text-gray-500 mb-1">إلى تاريخ</label><DateField value={endDate} onChange={setEndDate} /></div>
        <button onClick={handleExport} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">{loading ? 'جاري...' : <><Download size={18} /> تصدير CSV</>}</button>
      </div>
    </div>
  )
}

function OrderExporter() {
  const { toast } = useToast()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (!startDate || !endDate) { toast('يرجى اختيار الفترة الزمنية', 'error'); return }
    setLoading(true)
    try {
      const raw = await api.reports.sales(startDate, endDate)
      const seen = new Set<number>()
      const flat = raw.reduce((acc: any[], r: any) => {
        if (!seen.has(r.order_id)) {
          seen.add(r.order_id)
          acc.push({
            'رقم الفاتورة': r.order_id,
            'الاسم': r.customer_name || '',
            'رقم الهاتف': r.customer_phone || '',
            'العنوان': r.customer_address || '',
            'التاريخ': r.created_at ? formatDate(r.created_at) : '',
          })
        }
        return acc
      }, [])
      if (!flat.length) { toast('لا توجد بيانات', 'error'); return }
      downloadCSV(flat, `طلبات_${startDate}_${endDate}.csv`)
    } catch (err: any) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <h2 className="font-bold text-lg mb-4">تصدير بيانات الطلبات</h2>
      <p className="text-xs text-gray-400 mb-3">رقم الفاتورة، الاسم، الهاتف، العنوان</p>
      <div className="space-y-3">
        <div><label className="block text-sm text-gray-500 mb-1">من تاريخ</label><DateField value={startDate} onChange={setStartDate} /></div>
        <div><label className="block text-sm text-gray-500 mb-1">إلى تاريخ</label><DateField value={endDate} onChange={setEndDate} /></div>
        <button onClick={handleExport} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">{loading ? 'جاري...' : <><Download size={18} /> تصدير CSV</>}</button>
      </div>
    </div>
  )
}

function UserExporter() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const users = await api.auth.getUsers()
      const flat = users.map((u: any) => ({
        'الاسم': u.full_name || u.fullName || '',
        'اسم المستخدم': u.username || '',
        'الصلاحية': label(u.role),
        'نشط': u.is_active ? 'نعم' : 'لا',
      }))
      if (!flat.length) { toast('لا توجد بيانات', 'error'); return }
      downloadCSV(flat, 'المستخدمين.csv')
    } catch (err: any) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <h2 className="font-bold text-lg mb-4">تصدير بيانات المستخدمين</h2>
      <p className="text-xs text-gray-400 mb-3">الاسم، اسم المستخدم، الصلاحية</p>
      <div className="space-y-3">
        <button onClick={handleExport} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">{loading ? 'جاري...' : <><Download size={18} /> تصدير CSV</>}</button>
      </div>
    </div>
  )
}

function CustomerExporter() {
  const { toast } = useToast()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (!startDate || !endDate) { toast('يرجى اختيار الفترة الزمنية', 'error'); return }
    setLoading(true)
    try {
      const data = await api.reports.customers(startDate, endDate)
      const flat = data.map((r: any) => ({
        'الاسم': r.customer_name || '',
        'رقم الهاتف': r.customer_phone || '',
      }))
      if (!flat.length) { toast('لا توجد بيانات', 'error'); return }
      downloadCSV(flat, `العملاء_${startDate}_${endDate}.csv`)
    } catch (err: any) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <h2 className="font-bold text-lg mb-4">تصدير بيانات العملاء</h2>
      <p className="text-xs text-gray-400 mb-3">الاسم، رقم الهاتف</p>
      <div className="space-y-3">
        <div><label className="block text-sm text-gray-500 mb-1">من تاريخ</label><DateField value={startDate} onChange={setStartDate} /></div>
        <div><label className="block text-sm text-gray-500 mb-1">إلى تاريخ</label><DateField value={endDate} onChange={setEndDate} /></div>
        <button onClick={handleExport} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">{loading ? 'جاري...' : <><Download size={18} /> تصدير CSV</>}</button>
      </div>
    </div>
  )
}

function downloadCSV(data: any[], filename: string) {
  const csv = Papa.unparse(data)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
