import { useRef, useState, useCallback } from 'react'
import { Printer, CheckCircle, AlertTriangle, X } from 'lucide-react'

function esc(s: string | undefined | null): string {
  if (!s) return ''
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

function fmt(n: number | undefined | null, suffix = ''): string {
  if (n === undefined || n === null || isNaN(n)) return `0.00${suffix}`
  return `${n.toFixed(2)}${suffix}`
}

interface InvoiceData {
  orderId: number
  customerName: string
  customerPhone: string
  customerAddress?: string
  paymentMethod: string
  items: { name: string; qty: number; price: number; total: number }[]
  subtotal: number
  serviceAmount: number
  taxAmount: number
  discountAmount?: number
  couponCode?: string | null
  grandTotal: number
  date: string
  restaurantName: string
  logoUrl?: string
  cashierName: string
}

function escposText(text: string): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode(text + '\n')
}

function escposBold(text: string): Uint8Array {
  const bold = new Uint8Array([0x1B, 0x45, 0x01])
  const normal = new Uint8Array([0x1B, 0x45, 0x00])
  const encoder = new TextEncoder()
  const res = new Uint8Array([...bold, ...encoder.encode(text + '\n'), ...normal])
  return res
}

function escposCenter(text: string): Uint8Array {
  const center = new Uint8Array([0x1B, 0x61, 0x01])
  const left = new Uint8Array([0x1B, 0x61, 0x00])
  const encoder = new TextEncoder()
  return new Uint8Array([...center, ...encoder.encode(text + '\n'), ...left])
}

function escposDouble(text: string): Uint8Array {
  const dbl = new Uint8Array([0x1B, 0x21, 0x30])
  const norm = new Uint8Array([0x1B, 0x21, 0x00])
  const encoder = new TextEncoder()
  return new Uint8Array([...dbl, ...encoder.encode(text + '\n'), ...norm])
}

function escposCut(): Uint8Array {
  return new Uint8Array([0x1B, 0x6D])
}

const RECEIPT_W = 40

function escposLine(): Uint8Array {
  return escposText('─'.repeat(RECEIPT_W))
}

function buildEscposReceipt(data: InvoiceData): Uint8Array {
  const parts: Uint8Array[] = []
  const s = (n: number | undefined | null) => n === undefined || n === null || isNaN(n) ? '0.00' : n.toFixed(2)

  parts.push(escposCenter(data.restaurantName || 'مطعم'))
  parts.push(escposCenter('فاتورة ضريبية'))
  parts.push(escposLine())
  parts.push(escposText(''))
  parts.push(escposText(`رقم الفاتورة: #${data.orderId}`))
  parts.push(escposText(`التاريخ: ${data.date || ''}`))
  parts.push(escposText(`العميل: ${data.customerName || ''}${data.customerPhone ? ` (${data.customerPhone})` : ''}`))
  if (data.customerAddress) parts.push(escposText(`العنوان: ${data.customerAddress}`))
  parts.push(escposText(`الكاشير: ${data.cashierName || ''}`))
  parts.push(escposText(`طريقة الدفع: ${data.paymentMethod === 'cash' ? 'نقدي' : data.paymentMethod === 'visa' ? 'فيزا' : data.paymentMethod === 'wallet' ? 'محفظة' : data.paymentMethod || ''}`))
  parts.push(escposLine())
  parts.push(escposText(''))

  const colWidth = { num: 4, name: 14, qty: 4, price: 7, total: 7 }
  const headerLine = `${'#'.padStart(colWidth.num)}  ${'الصنف'.padEnd(colWidth.name)} ${'الكم'.padStart(colWidth.qty)} ${'السعر'.padStart(colWidth.price)} ${'الإجمالي'.padStart(colWidth.total)}`
  parts.push(escposBold(headerLine))

  const w = colWidth
  ;(data.items || []).forEach((item, i) => {
    const name = (item?.name || '').substring(0, w.name).padEnd(w.name)
    const qty = String(item?.qty || 0).padStart(w.qty)
    const price = s(item?.price).padStart(w.price)
    const total = s(item?.total).padStart(w.total)
    parts.push(escposText(`${String(i + 1).padStart(w.num)}  ${name} ${qty} ${price} ${total}`))
  })

  parts.push(escposLine())
  parts.push(escposText(`${'المجموع الفرعي:'.padStart(25)} ${s(data.subtotal)} ج.م`))
  if (data.serviceAmount) parts.push(escposText(`${'رسوم خدمة:'.padStart(25)} ${s(data.serviceAmount)} ج.م`))
  if (data.taxAmount) parts.push(escposText(`${'ضريبة:'.padStart(25)} ${s(data.taxAmount)} ج.م`))
  if (data.discountAmount) parts.push(escposText(`${'خصم:'.padStart(25)} -${s(data.discountAmount)} ج.م`))
  parts.push(escposDouble(`${'الإجمالي:'.padStart(22)} ${s(data.grandTotal)} ج.م`))
  parts.push(escposText(''))
  parts.push(escposCenter('شكراً لزيارتكم'))
  parts.push(escposText(''))
  parts.push(escposCut())

  const totalLen = parts.reduce((sum, p) => sum + p.length, 0)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const p of parts) {
    result.set(p, offset)
    offset += p.length
  }
  return result
}

export default function InvoicePrint({ data, onClose }: { data: InvoiceData; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null)
  const [printerStatus, setPrinterStatus] = useState('')

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const itemsHtml = (data.items || []).map((item, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(item?.name)}</td>
        <td style="text-align:center">${item?.qty || 0}</td>
        <td style="text-align:left">${fmt(item?.price)}</td>
        <td style="text-align:left">${fmt(item?.total)}</td>
      </tr>
    `).join('')

    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>فاتورة #${data.orderId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Cairo', 'Courier New', monospace; direction: rtl; padding: 10px; margin: 0; font-size: 12px; color: #000; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
          .header h2 { margin: 0; font-size: 18px; color: #000; }
          .header p { margin: 2px 0; font-size: 11px; color: #333; }
          .info { font-size: 11px; margin-bottom: 8px; color: #000; }
          .info div { display: flex; justify-content: space-between; padding: 2px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; color: #000; }
          th, td { padding: 3px; text-align: right; }
          th { border-bottom: 2px solid #000; font-size: 11px; color: #000; }
          td { border-bottom: 1px dotted #999; }
          .totals { margin-top: 8px; font-size: 12px; color: #000; }
          .totals div { display: flex; justify-content: space-between; padding: 2px 0; }
          .grand-total { font-size: 16px; font-weight: bold; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
          .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #555; border-top: 1px dashed #999; padding-top: 6px; }
          .discount { color: #c00; }
        </style>
      </head>
      <body>
        <div class="header">
          ${data.logoUrl ? `<img src="${esc(data.logoUrl)}" style="max-height:60px;width:auto;margin-bottom:4px;object-fit:contain" />` : ''}
          <h2>${esc(data.restaurantName) || ''}</h2>
          <p>فاتورة ضريبية</p>
          <p>رقم الفاتورة: #${data.orderId}</p>
        </div>
        <div class="info">
          <div><span>التاريخ:</span><span>${esc(data.date) || ''}</span></div>
          <div><span>العميل:</span><span>${esc(data.customerName) || ''}</span></div>
          ${data.customerPhone ? `<div><span>التليفون:</span><span>${esc(data.customerPhone)}</span></div>` : ''}
          ${data.customerAddress ? `<div><span>العنوان:</span><span>${esc(data.customerAddress)}</span></div>` : ''}
          <div><span>الكاشير:</span><span>${esc(data.cashierName) || ''}</span></div>
          <div><span>طريقة الدفع:</span><span>${data.paymentMethod === 'cash' ? 'نقدي' : data.paymentMethod === 'visa' ? 'فيزا' : data.paymentMethod === 'wallet' ? 'محفظة' : data.paymentMethod || ''}</span></div>
        </div>
        <table>
          <thead><tr><th style="width:25px">#</th><th>الصنف</th><th style="width:30px">الكمية</th><th style="width:45px">السعر</th><th style="width:50px">الإجمالي</th></tr></thead>
          <tbody>${itemsHtml || '<tr><td colspan="5" style="text-align:center;color:#999">لا توجد أصناف</td></tr>'}</tbody>
        </table>
        <div class="totals">
          <div><span>المجموع الفرعي:</span><span>${fmt(data.subtotal)} ج.م</span></div>
          ${data.serviceAmount ? `<div><span>رسوم خدمة:</span><span>${fmt(data.serviceAmount)} ج.م</span></div>` : ''}
          ${data.taxAmount ? `<div><span>ضريبة:</span><span>${fmt(data.taxAmount)} ج.م</span></div>` : ''}
          ${data.discountAmount ? `<div class="discount"><span>خصم${data.couponCode ? ` (${esc(data.couponCode)})` : ''}:</span><span>-${fmt(data.discountAmount)} ج.م</span></div>` : ''}
          <div class="grand-total"><span>الإجمالي:</span><span>${fmt(data.grandTotal)} ج.م</span></div>
        </div>
        <div class="footer">
          <p>شكراً لزيارتكم</p>
        </div>
        <script>window.print();window.onafterprint=function(){window.close()};<\/script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handleDirectPrint = async () => {
    setPrinterStatus('جاري الاتصال بالطابعة...')
    try {
      const device = await (navigator as any).usb.requestDevice({ filters: [] })
      await device.open()
      await device.selectConfiguration(1)
      await device.claimInterface(0)

      const receipt = buildEscposReceipt(data)
      await device.transferOut(1, receipt)

      setPrinterStatus('تمت الطباعة بنجاح')
      setTimeout(() => setPrinterStatus(''), 3000)
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        setPrinterStatus('لم يتم اختيار طابعة')
      } else {
        setPrinterStatus('فشلت الطباعة المباشرة. استخدم طباعة المتصفح.')
      }
      setTimeout(() => setPrinterStatus(''), 4000)
    }
  }

  const canUsb = typeof (navigator as any).usb !== 'undefined'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">تم حفظ الطلب</h2>
          <button type="button" onClick={(e) => { e.stopPropagation(); onClose() }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800" aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>
        <div ref={printRef} className="text-center">
          <p className="text-3xl font-bold text-green-700 mb-4">{fmt(data.grandTotal)} ج.م</p>
          <p className="text-gray-500 mb-2">رقم الفاتورة: #{data.orderId}</p>
          <p className="text-gray-500 mb-2">العميل: {esc(data.customerName)}</p>
          <p className="text-gray-500 mb-6">الكاشير: {data.cashierName}</p>

          {printerStatus && (
            <p className={`text-sm mb-3 flex items-center justify-center gap-1 ${printerStatus.includes('نجاح') ? 'text-green-600' : 'text-orange-600'}`}>
              {printerStatus.includes('نجاح') ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {printerStatus}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {canUsb && (
              <button onClick={handleDirectPrint} className="btn-primary py-3 text-lg flex items-center justify-center gap-2">
                <Printer size={20} /> طباعة مباشرة (USB)
              </button>
            )}
            <button onClick={handlePrint} className="btn-secondary py-3 text-lg flex items-center justify-center gap-2">
              <Printer size={20} /> طباعة عبر المتصفح
            </button>
            <button onClick={(e) => { e.stopPropagation(); onClose() }} className="w-full py-3 text-lg bg-gray-100 hover:bg-gray-200 rounded-xl font-medium">
              إغلاق
            </button>
          </div>
          {!canUsb && (
            <p className="text-xs text-gray-400 mt-2">الطباعة المباشرة متاحة على Chrome/Edge</p>
          )}
        </div>
      </div>
    </div>
  )
}
