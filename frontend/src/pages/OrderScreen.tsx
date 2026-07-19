import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { api } from '../api/client'
import InvoicePrint from '../components/InvoicePrint'
import { useAuth } from '../context/AuthContext'
import { formatDateTime } from '../lib/format'

interface MenuItem {
  id: number
  name: string
  price: number
  options: string
  category_name: string
}

interface OrderItem {
  menuItemId: number
  itemName: string
  unitPrice: number
  quantity: number
  subtotal: number
  optionName: string | null
}

export default function OrderScreen() {
  const { user } = useAuth()
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [settings, setSettings] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [discountInfo, setDiscountInfo] = useState<any>(null)
  const [couponError, setCouponError] = useState('')
  const [invoiceData, setInvoiceData] = useState<any>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    loadData().then(() => { if (!mounted) return }).catch(() => {})
    return () => { mounted = false }
  }, [])

  const loadData = async () => {
    try {
      const items = await api.menu.getActive()
      setMenuItems(items)
    } catch (err) { console.error('loadData menu error:', err) }
    try {
      const sett = await api.settings.get()
      setSettings(sett)
      if (sett?.payment_methods) {
        setPaymentMethod(sett.payment_methods.split(',')[0])
      }
    } catch (err) { console.error('loadData settings error:', err) }
  }

  const filteredItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.category_name && item.category_name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const addToOrder = (item: MenuItem) => {
    let unitPrice = item.price
    let optionName: string | null = null
                  const options = item.options ? (() => { try { return JSON.parse(item.options) } catch { return [] } })() : []

    if (options.length > 0) {
      unitPrice = options[0].price || item.price
      optionName = options[0].name
    }

    const existing = orderItems.find(
      (oi) => oi.menuItemId === item.id && oi.optionName === optionName
    )

    if (existing) {
      setOrderItems(
        orderItems.map((oi) =>
          oi.menuItemId === item.id && oi.optionName === optionName
            ? { ...oi, quantity: oi.quantity + 1, subtotal: (oi.quantity + 1) * oi.unitPrice }
            : oi
        )
      )
    } else {
      setOrderItems([
        ...orderItems,
        {
          menuItemId: item.id,
          itemName: item.name,
          unitPrice,
          quantity: 1,
          subtotal: unitPrice,
          optionName,
        },
      ])
    }

    setSearchQuery('')
    setShowMenu(false)
    searchRef.current?.focus()
  }

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) {
      setOrderItems(orderItems.filter((_, i) => i !== index))
      return
    }
    setOrderItems(
      orderItems.map((item, i) =>
        i === index
          ? { ...item, quantity: newQty, subtotal: newQty * item.unitPrice }
          : item
      )
    )
  }

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
  const taxPercent = settings?.tax_percentage || 0
  const servicePercent = settings?.service_charge_percentage || 0
  const chargeBase = settings?.charge_base || 'before_tax'

  let serviceAmount = 0
  let taxAmount = 0

  if (chargeBase === 'before_tax') {
    serviceAmount = subtotal * (servicePercent / 100)
    taxAmount = subtotal * (taxPercent / 100)
  } else {
    serviceAmount = subtotal * (servicePercent / 100)
    taxAmount = (subtotal + serviceAmount) * (taxPercent / 100)
  }

  const grandTotal = subtotal + serviceAmount + taxAmount

  const paymentMethods = settings?.payment_methods
    ? settings.payment_methods.split(',').map((m: string) => m.trim())
    : ['cash']

  const paymentLabels: Record<string, string> = {
    cash: 'نقدي',
    visa: 'فيزا',
    wallet: 'محفظة إلكترونية',
  }

  const handleValidateCoupon = async () => {
    setCouponError('')
    setDiscountInfo(null)
    if (!couponCode.trim()) return
    try {
      const coupon = await api.coupons.getByCode(couponCode.trim())
      if (coupon.min_order > 0 && subtotal < coupon.min_order) {
        setCouponError(`الحد الأدنى للطلب: ${coupon.min_order} ج.م`)
        return
      }
      setDiscountInfo(coupon)
    } catch (err) {
      console.error('Coupon validation error:', err)
      setCouponError('الكوبون غير صالح')
    }
  }

  const handleSaveOrder = async () => {
    if (!customerName.trim()) {
      setErrorMessage('يرجى إدخال اسم العميل')
      return
    }
    if (orderItems.length === 0) {
      setErrorMessage('يرجى إضافة أصناف إلى الطلب')
      return
    }

    setSaving(true)
    setErrorMessage('')

    try {
      const result = await api.orders.create({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        paymentMethod,
        couponCode: couponCode.trim() || undefined,
        items: orderItems.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          optionName: item.optionName,
        })),
      })

      setInvoiceData({
        orderId: result.orderId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        paymentMethod,
        items: orderItems.map((item) => ({
          name: item.optionName ? `${item.itemName} (${item.optionName})` : item.itemName,
          qty: item.quantity,
          price: item.unitPrice,
          total: item.subtotal,
        })),
        subtotal: result.subtotal,
        serviceAmount: result.serviceAmount,
        taxAmount: result.taxAmount,
        discountAmount: result.discountAmount,
        couponCode: result.couponCode,
        grandTotal: result.grandTotal,
        date: formatDateTime(new Date().toISOString()),
        restaurantName: settings?.restaurant_name || 'مطعم',
        logoUrl: settings?.logo_url || '',
        cashierName: user?.fullName || '',
      })
      setCustomerName('')
      setCustomerPhone('')
      setOrderItems([])
      setCouponCode('')
      setDiscountInfo(null)
      setCouponError('')
      setPaymentMethod(paymentMethods[0] || 'cash')
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ الطلب')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">تسجيل طلب جديد</h1>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-center font-medium">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {errorMessage}
        </div>
      )}

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">اسم العميل</label>
            <input
              className="input-field"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="أدخل اسم العميل"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">رقم التليفون</label>
            <input
              className="input-field"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="أدخل رقم التليفون (اختياري)"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">العنوان (اختياري)</label>
            <input
              className="input-field"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="أدخل عنوان العميل"
            />
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">كود الخصم (اختياري)</label>
              <input
                className="input-field"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value); setDiscountInfo(null); setCouponError('') }}
                placeholder="أدخل كود الخصم"
              />
              {discountInfo && (
                <p className="text-green-600 text-xs mt-1">
                  خصم {discountInfo.discount_type === 'percentage' ? `${discountInfo.discount_value}%` : `${discountInfo.discount_value} ج.م`}
                </p>
              )}
              {couponError && <p className="text-red-600 text-xs mt-1">{couponError}</p>}
            </div>
            <button type="button" onClick={handleValidateCoupon} className="btn-secondary h-[42px] shrink-0">تحقق</button>
          </div>
        </div>

        <div className="relative">
          <label className="block text-sm font-medium mb-1">إضافة صنف</label>
          <input
            ref={searchRef}
            className="input-field"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowMenu(true) }}
            onFocus={() => setShowMenu(true)}
            placeholder="ابحث عن صنف..."
          />
          {showMenu && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
    const options = item.options ? (() => { try { return JSON.parse(item.options) } catch { return [] } })() : []
                  return (
                    <button
                      key={item.id}
                      onClick={() => addToOrder(item)}
                      className="w-full text-right px-4 py-3 hover:bg-green-50 border-b border-gray-100 last:border-b-0 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-medium">{item.name}</span>
                        {options.length > 0 && (
                          <span className="text-xs text-gray-400 mr-2">
                            ({options.map((o: any) => `${o.name}: ${o.price} ج.م`).join(' | ')})
                          </span>
                        )}
                      </div>
                      <span className="text-green-700 font-bold">{item.price} ج.م</span>
                    </button>
                  )
                })
              ) : (
                <p className="text-center text-gray-400 py-4">لا توجد نتائج</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card mb-4">
        <h2 className="font-bold text-lg mb-4">الأصناف المختارة</h2>
        {orderItems.length === 0 ? (
          <p className="text-center text-gray-400 py-8">لم يتم إضافة أي أصناف بعد</p>
        ) : (
          <div className="space-y-2">
            {orderItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{item.itemName}</p>
                  {item.optionName && <p className="text-xs text-gray-500">{item.optionName}</p>}
                  <p className="text-sm text-gray-500">{item.unitPrice} ج.م / للواحدة</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(index, item.quantity - 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(index, item.quantity + 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>
                  <p className="w-24 text-left font-bold text-green-700">{item.subtotal.toFixed(2)} ج.م</p>
                  <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">طريقة الدفع</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input-field w-40"
            >
              {paymentMethods.map((method: string) => (
                <option key={method} value={method}>
                  {paymentLabels[method] || method}
                </option>
              ))}
            </select>
          </div>
          <div className="text-left md:text-left">
            <div className="text-sm text-gray-500">
              <p>المجموع الفرعي: <span className="text-gray-800">{subtotal.toFixed(2)} ج.م</span></p>
              {servicePercent > 0 && <p>رسوم خدمة ({servicePercent}%): <span className="text-gray-800">{serviceAmount.toFixed(2)} ج.م</span></p>}
              {taxPercent > 0 && <p>ضريبة ({taxPercent}%): <span className="text-gray-800">{taxAmount.toFixed(2)} ج.م</span></p>}
            </div>
            <p className="text-2xl font-bold text-green-700 mt-2">{grandTotal.toFixed(2)} ج.م</p>
            <p className="text-xs text-gray-400">الإجمالي الكلي</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleSaveOrder}
        disabled={saving || orderItems.length === 0}
        className="btn-primary w-full py-4 text-lg"
      >
        {saving ? 'جاري حفظ الطلب...' : 'حفظ الطلب'}
      </button>

      {invoiceData && (
        <InvoicePrint
          data={invoiceData}
          onClose={() => setInvoiceData(null)}
        />
      )}
    </div>
  )
}
