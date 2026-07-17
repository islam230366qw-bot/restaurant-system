import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Area, AreaChart } from 'recharts'
import { api } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import { useToast } from '../components/Toast'
import { formatDate, toApiDate } from '../lib/format'
import DateField from '../components/DateField'

const PIE_COLORS = ['#16a34a', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6']

function payLabel(m: string): string {
  if (m === 'cash') return 'نقدي'
  if (m === 'visa') return 'فيزا'
  if (m === 'wallet') return 'محفظة'
  return m || ''
}

export default function Dashboard() {
  const { toast } = useToast()
  const [summary, setSummary] = useState<any>(null)
  const [topItems, setTopItems] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [paymentData, setPaymentData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [customMode, setCustomMode] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    loadData()
    return () => ac.abort()
  }, [])

  const loadData = async (start?: string, end?: string) => {
    setLoading(true)
    try {
      if (start && end) {
        const [summ, items, chart, payments] = await Promise.all([
          api.dashboard.summary(start, end),
          api.dashboard.topItems(start, end),
          api.dashboard.salesChart(start, end),
          api.dashboard.salesByPayment(start, end),
        ])
        setSummary(summ)
        setTopItems(items)
        setChartData(chart || [])
        setPaymentData(payments || [])
      } else {
        const [summ, items, chart, payments] = await Promise.all([
          api.dashboard.summary(),
          api.dashboard.topItems(),
          api.dashboard.salesChart(),
          api.dashboard.salesByPayment(),
        ])
        setSummary(summ)
        setTopItems(items)
        setChartData(chart || [])
        setPaymentData(payments || [])
      }
    } catch (err: any) {
      toast(err.message || 'فشل تحميل الداش بورد', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCustomFilter = () => {
    if (startDate && endDate) {
      setCustomMode(true)
      loadData(toApiDate(startDate), toApiDate(endDate))
    }
  }

  const resetFilter = () => {
    setCustomMode(false)
    setStartDate('')
    setEndDate('')
    loadData()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">الداش بورد</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <DateField value={startDate} onChange={setStartDate} className="w-32" />
          <DateField value={endDate} onChange={setEndDate} className="w-32" />
          <button onClick={handleCustomFilter} className="btn-primary">عرض</button>
          {customMode && <button onClick={resetFilter} className="btn-secondary">إعادة تعيين</button>}
        </div>
      </div>

      {!customMode && summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card-stat">
            <p className="text-gray-500 text-sm">مبيعات اليوم</p>
            <p className="text-2xl font-bold text-green-700">{summary.todaySales?.toFixed(2) || '0'} ج.م</p>
            <p className="text-xs text-gray-400">{summary.todayOrders || 0} طلب - {formatDate(new Date().toISOString())}</p>
          </div>
          <div className="card-stat">
            <p className="text-gray-500 text-sm">مبيعات الأسبوع</p>
            <p className="text-2xl font-bold text-blue-700">{summary.weekSales?.toFixed(2) || '0'} ج.م</p>
            <p className="text-xs text-gray-400">{summary.weekOrders || 0} طلب</p>
          </div>
          <div className="card-stat">
            <p className="text-gray-500 text-sm">مبيعات الشهر</p>
            <p className="text-2xl font-bold text-purple-700">{summary.monthSales?.toFixed(2) || '0'} ج.م</p>
            <p className="text-xs text-gray-400">{summary.monthOrders || 0} طلب</p>
          </div>
        </div>
      )}

      {customMode && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="card-stat">
            <p className="text-gray-500 text-sm">إجمالي المبيعات</p>
            <p className="text-2xl font-bold text-green-700">{summary.totalSales?.toFixed(2) || '0'} ج.م</p>
          </div>
          <div className="card-stat">
            <p className="text-gray-500 text-sm">عدد الطلبات</p>
            <p className="text-2xl font-bold text-blue-700">{summary.totalOrders || 0}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h2 className="font-bold text-lg mb-4">المبيعات عبر الوقت</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="sale_date" tickFormatter={(v) => formatDate(v)} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  labelFormatter={(v) => formatDate(v)}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                  formatter={(value: number) => [Number(value).toFixed(2) + ' ج.م', 'المبيعات']}
                />
                <Area type="monotone" dataKey="total_sales" stroke="#16a34a" strokeWidth={2} fill="url(#salesGradient)" name="المبيعات" dot={{ r: 3, fill: '#16a34a', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#16a34a', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <svg className="w-16 h-16 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
              <p className="text-lg mb-1">لا توجد بيانات مبيعات</p>
              <p className="text-sm">قم بإنشاء طلبات جديدة لعرض المخطط</p>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-bold text-lg mb-4">طرق الدفع</h2>
          {paymentData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={paymentData} dataKey="total" nameKey="payment_method" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} labelLine={false}>
                    {paymentData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${Number(value).toFixed(2)} ج.م`} />
                  <Legend formatter={(v) => payLabel(v)} verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1 px-2">
                {paymentData.map((m: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                      <span>{payLabel(m.payment_method)}</span>
                    </div>
                    <span className="font-bold">{Number(m.total).toFixed(2)} ج.م</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <svg className="w-16 h-16 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
              <p className="text-lg mb-1">لا توجد بيانات مبيعات</p>
              <p className="text-sm">قم بإنشاء طلبات جديدة لعرض الإحصائيات</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="card lg:col-span-2">
          <h2 className="font-bold text-lg mb-4">أكثر 5 أصناف مبيعًا</h2>
          {topItems.length > 0 ? (
            <div className="space-y-3">
              {topItems.map((item, index) => (
                <div key={item.menu_item_id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs flex items-center justify-center">{index + 1}</span>
                    <span className="font-medium">{item.item_name_snapshot}</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-green-700">{item.total_quantity}</p>
                    <p className="text-xs text-gray-500">{Number(item.total_revenue).toFixed(2)} ج.م</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <p className="text-lg mb-2">🏆 لا توجد أصناف مبيعة بعد</p>
              <p className="text-sm">ستظهر هنا أكثر الأصناف مبيعاً</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
