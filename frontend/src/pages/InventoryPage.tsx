import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'
import { AlertTriangle, Package, Pencil, Trash2, Plus, Minus, Settings } from 'lucide-react'
import { formatDateTime } from '../lib/format'

export default function InventoryPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [showAdjust, setShowAdjust] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'low'>('all')
  const [form, setForm] = useState({ name: '', category: '', quantity: '', unit: 'قطعة', minQuantity: '', unitCost: '', supplier: '' })

  useEffect(() => { const ac = new AbortController(); loadItems(); return () => ac.abort() }, [])

  const loadItems = async () => {
    setLoading(true)
    try {
      if (filter === 'low') setItems(await api.inventory.getLowStock())
      else setItems(await api.inventory.getAll())
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { loadItems() }, [filter])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', category: '', quantity: '0', unit: 'قطعة', minQuantity: '0', unitCost: '0', supplier: '' })
    setShowForm(true)
  }

  const openEdit = (item: any) => {
    setEditing(item)
    setForm({
      name: item.name, category: item.category || '', quantity: item.quantity.toString(),
      unit: item.unit, minQuantity: item.min_quantity.toString(),
      unitCost: item.unit_cost.toString(), supplier: item.supplier || '',
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        name: form.name, category: form.category || undefined,
        quantity: parseFloat(form.quantity), unit: form.unit,
        minQuantity: parseFloat(form.minQuantity) || 0,
        unitCost: parseFloat(form.unitCost) || 0, supplier: form.supplier || undefined,
      }
      if (editing) await api.inventory.update(editing.id, data)
      else await api.inventory.create(data)
      setShowForm(false)
      loadItems()
    } catch (err: any) { toast(err.message, 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return
    try { await api.inventory.delete(id); loadItems() }
    catch (err: any) { toast(err.message, 'error') }
  }

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">المخزون</h1>
        <button onClick={openAdd} className="btn-primary">+ إضافة صنف</button>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}>الكل</button>
        <button onClick={() => setFilter('low')} className={`px-4 py-2 rounded-lg ${filter === 'low' ? 'bg-amber-600 text-white' : 'bg-white text-gray-700'}`}>مخزون منخفض</button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-xl shadow-md">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-right p-3">الاسم</th>
                <th className="text-right p-3">التصنيف</th>
                <th className="text-right p-3">الكمية</th>
                <th className="text-right p-3">الحد الأدنى</th>
                <th className="text-right p-3">تكلفة الوحدة</th>
                <th className="text-right p-3">المورد</th>
                <th className="text-left p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity
                return (
                  <tr key={item.id} className={`border-b hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}`}>
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3">{item.category || '-'}</td>
                    <td className="p-3">
                      <span className={`font-bold ${isLow ? 'text-red-600' : 'text-green-700'}`}>
                        {item.quantity} {item.unit}
                      </span>
                      {isLow && <AlertTriangle size={14} className="text-red-500 inline mr-1" />}
                    </td>
                    <td className="p-3">{item.min_quantity > 0 ? `${item.min_quantity} ${item.unit}` : '-'}</td>
                    <td className="p-3">{item.unit_cost > 0 ? `${item.unit_cost.toFixed(2)} ج.م` : '-'}</td>
                    <td className="p-3">{item.supplier || '-'}</td>
                    <td className="p-3 text-left">
                      <button onClick={() => setShowAdjust(item)} className="text-amber-600 hover:text-amber-800 p-1" title="تعديل الكمية"><Package size={16} /></button>
                      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 p-1" title="تعديل"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800 p-1" title="حذف"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr><td colSpan={7} className="text-center p-8 text-gray-400">لا يوجد أصناف في المخزون</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editing ? 'تعديل صنف' : 'إضافة صنف'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">الاسم</label>
                <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">التصنيف</label>
                  <input className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="مثال: خضار, لحوم" list="categories" />
                  <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الوحدة</label>
                  <input className="input-field" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="كيلو, لتر, قطعة" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">الكمية الحالية</label>
                  <input type="number" step="0.01" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الحد الأدنى</label>
                  <input type="number" step="0.01" className="input-field" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">تكلفة الوحدة (ج.م)</label>
                  <input type="number" step="0.01" className="input-field" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">المورد</label>
                  <input className="input-field" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'جاري الحفظ...' : (editing ? 'حفظ' : 'إضافة')}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdjust && (
        <AdjustModal item={showAdjust} onClose={() => { setShowAdjust(null); loadItems() }} />
      )}
    </div>
  )
}

function AdjustModal({ item, onClose }: { item: any; onClose: () => void }) {
  const { toast } = useToast()
  const [type, setType] = useState<'add' | 'remove' | 'adjust'>('add')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [log, setLog] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.inventory.getLog(item.id).then(setLog).catch(() => {})
  }, [item.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!qty) return
    setLoading(true)
    try {
      await api.inventory.adjust(item.id, { changeType: type, quantityChange: parseFloat(qty), note: note || undefined })
      setQty(''); setNote('')
      api.inventory.getLog(item.id).then(setLog)
    } catch (err: any) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">{item.name}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>
        <p className="text-3xl font-bold text-green-700 mb-4">{item.quantity} {item.unit}</p>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setType('add')} className={`px-3 py-1 rounded ${type === 'add' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>+ إضافة</button>
          <button onClick={() => setType('remove')} className={`px-3 py-1 rounded ${type === 'remove' ? 'bg-red-600 text-white' : 'bg-gray-100'}`}>- صرف</button>
          <button onClick={() => setType('adjust')} className={`px-3 py-1 rounded ${type === 'adjust' ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>تعديل</button>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <input type="number" step="0.01" className="input-field flex-1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="الكمية" required />
          <input className="input-field flex-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" />
          <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'حفظ'}</button>
        </form>

        {log.length > 0 && (
          <div>
            <h3 className="font-bold text-sm mb-2">سجل الحركات</h3>
            <div className="max-h-40 overflow-y-auto text-sm">
              {log.map((entry: any) => (
                <div key={entry.id} className="flex justify-between py-1 border-b text-xs">
                  <span>{entry.change_type === 'add' ? <Plus size={14} className="text-green-600 inline" /> : entry.change_type === 'remove' ? <Minus size={14} className="text-red-600 inline" /> : <Settings size={14} className="text-amber-600 inline" />}</span>
                  <span>{entry.quantity_before} → {entry.quantity_after}</span>
                  <span className="text-gray-400">{formatDateTime(entry.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={onClose} className="btn-secondary w-full mt-4">إغلاق</button>
      </div>
    </div>
  )
}
