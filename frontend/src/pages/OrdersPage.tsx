import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import InvoicePrint from '../components/InvoicePrint'
import LoadingSpinner from '../components/LoadingSpinner'
import { Eye, Printer, Ban, Trash2 } from 'lucide-react'
import { formatDate, formatDateTime, toApiDate } from '../lib/format'
import DateField from '../components/DateField'

const paymentLabels: Record<string, string> = {
  cash: 'نقدي', visa: 'فيزا', wallet: 'محفظة إلكترونية',
}

export default function OrdersPage() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [invoiceData, setInvoiceData] = useState<any>(null)
  const [details, setDetails] = useState<any>(null)
  const [restaurantName, setRestaurantName] = useState('مطعم')
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => { loadOrders() }, [page])
  useEffect(() => {
    api.settings.get().then(r => {
      setRestaurantName(r.restaurant_name || 'مطعم')
      setLogoUrl(r.logo_url || '')
    }).catch(() => {})
  }, [])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const data = await api.orders.getAll({ startDate: startDate ? toApiDate(startDate) : undefined, endDate: endDate ? toApiDate(endDate) : undefined, page, limit })
      setOrders(data.orders)
      setTotal(data.total)
    } catch (err: any) { toast(err.message || 'فشل تحميل الطلبات', 'error') }
    finally { setLoading(false) }
  }

  const handleSearch = () => { setPage(1); loadOrders() }

  const handleViewDetails = async (order: any) => {
    setSelectedOrder(order)
    try {
      const full = await api.orders.getById(order.id)
      setDetails(full)
    } catch { setDetails(null) }
  }

  const handlePrintInvoice = async (order: any) => {
    let items = order.items || []
    let cashierName = order.created_by_name || ''
    if (!items.length) {
      try {
        const full = await api.orders.getById(order.id)
        items = full.items || []
        cashierName = full.created_by_name || cashierName
      } catch {}
    }
    setInvoiceData({
      orderId: order.id,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerAddress: order.customer_address,
      paymentMethod: order.payment_method,
      items: items.map((item: any) => ({
        name: item.item_name_snapshot,
        qty: item.quantity,
        price: item.unit_price_snapshot,
        total: item.subtotal,
      })),
      subtotal: order.subtotal,
      serviceAmount: order.service_amount,
      taxAmount: order.tax_amount,
      discountAmount: order.discount_amount,
      couponCode: order.coupon_code,
      grandTotal: order.grand_total,
      date: formatDateTime(order.created_at),
      restaurantName,
      logoUrl,
      cashierName,
    })
  }

  const handleVoidOrder = async (id: number) => {
    if (!confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) return
    try {
      await api.orders.void(id)
      loadOrders()
    } catch (err: any) { toast(err.message, 'error') }
  }

  const handleDeleteOrder = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟')) return
    try {
      await api.orders.delete(id)
      loadOrders()
    } catch (err: any) { toast(err.message, 'error') }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">الطلبات</h1>

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
          <button onClick={handleSearch} className="btn-primary h-[42px]">بحث</button>
          <button onClick={() => { setStartDate(''); setEndDate(''); setPage(1); setTimeout(loadOrders, 0) }} className="btn-secondary h-[42px]">مسح</button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          <p className="text-sm text-gray-500 mb-2">إجمالي الطلبات: {total}</p>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl shadow-md">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right p-3">#</th>
                  <th className="text-right p-3">العميل</th>
                  <th className="text-right p-3">التاريخ</th>
                  <th className="text-right p-3">طريقة الدفع</th>
                  <th className="text-right p-3">الإجمالي</th>
                  <th className="text-right p-3">الخصم</th>
                  <th className="text-right p-3">الكاشير</th>
                  <th className="text-right p-3">الحالة</th>
                  <th className="text-left p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className={`border-b hover:bg-gray-50 ${o.voided ? 'opacity-50 line-through' : ''}`}>
                    <td className="p-3 font-medium">{o.id}</td>
                    <td className="p-3">{o.customer_name}</td>
                    <td className="p-3 text-sm">{formatDateTime(o.created_at)}</td>
                    <td className="p-3">{paymentLabels[o.payment_method] || o.payment_method}</td>
                    <td className="p-3 font-bold">{o.grand_total?.toFixed(2)}</td>
                    <td className="p-3 text-red-600">{o.discount_amount ? `-${o.discount_amount.toFixed(2)}` : '-'}</td>
                    <td className="p-3 text-sm">{o.created_by_name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${o.voided ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {o.voided ? 'ملغي' : 'مكتمل'}
                      </span>
                    </td>
                    <td className="p-3 text-left">
                      <div className="flex gap-1">
                        <button onClick={() => handleViewDetails(o)} className="text-blue-600 hover:text-blue-800 p-1" title="عرض"><Eye size={16} /></button>
                        <button onClick={() => handlePrintInvoice(o)} className="text-gray-600 hover:text-gray-800 p-1" title="طباعة"><Printer size={16} /></button>
                        {!o.voided && <button onClick={() => handleVoidOrder(o.id)} className="text-orange-600 hover:text-orange-800 p-1" title="إلغاء"><Ban size={16} /></button>}
                        <button onClick={() => handleDeleteOrder(o.id)} className="text-red-600 hover:text-red-800 p-1" title="حذف"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={9} className="text-center p-8 text-gray-400">لا يوجد طلبات</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary">السابق</button>
              <span className="px-4 py-2 text-sm">صفحة {page} من {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary">التالي</button>
            </div>
          )}
        </>
      )}

      {details && selectedOrder && (
        <div className="modal-overlay" onClick={() => setDetails(null)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">تفاصيل الطلب #{selectedOrder.id}</h2>
              <button type="button" onClick={() => setDetails(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">العميل:</span> {selectedOrder.customer_name}</p>
              <p><span className="font-medium">التليفون:</span> {selectedOrder.customer_phone || '-'}</p>
              <p><span className="font-medium">طريقة الدفع:</span> {paymentLabels[selectedOrder.payment_method]}</p>
              <p><span className="font-medium">الكاشير:</span> {selectedOrder.created_by_name}</p>
              <p><span className="font-medium">التاريخ:</span> {formatDateTime(selectedOrder.created_at)}</p>
              {selectedOrder.coupon_code && <p><span className="font-medium">كود الخصم:</span> {selectedOrder.coupon_code} <span className="text-red-600">(-{selectedOrder.discount_amount?.toFixed(2)})</span></p>}
            </div>
            <hr className="my-3" />
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-right p-2">الصنف</th><th className="text-center p-2">الكمية</th><th className="text-center p-2">السعر</th><th className="text-left p-2">الإجمالي</th></tr></thead>
              <tbody>
                {(details?.items || []).map((item: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{item.item_name_snapshot}{item.option_name_snapshot ? ` (${item.option_name_snapshot})` : ''}</td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-center">{item.unit_price_snapshot?.toFixed(2)}</td>
                    <td className="p-2 text-left">{item.subtotal?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <hr className="my-3" />
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span>المجموع الفرعي</span><span>{selectedOrder.subtotal?.toFixed(2)}</span></div>
              {selectedOrder.service_amount > 0 && <div className="flex justify-between"><span>رسوم خدمة</span><span>{selectedOrder.service_amount?.toFixed(2)}</span></div>}
              {selectedOrder.tax_amount > 0 && <div className="flex justify-between"><span>ضريبة</span><span>{selectedOrder.tax_amount?.toFixed(2)}</span></div>}
              {selectedOrder.discount_amount > 0 && <div className="flex justify-between text-red-600"><span>خصم</span><span>-{selectedOrder.discount_amount?.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>الإجمالي</span><span>{selectedOrder.grand_total?.toFixed(2)}</span></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setDetails(null); handlePrintInvoice(selectedOrder) }} className="btn-primary flex-1"><Printer size={16} className="inline ml-1" /> طباعة</button>
              <button onClick={() => setDetails(null)} className="btn-secondary flex-1">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {invoiceData && (
        <InvoicePrint data={invoiceData} onClose={() => setInvoiceData(null)} />
      )}
    </div>
  )
}
