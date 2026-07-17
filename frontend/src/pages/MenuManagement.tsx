import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'
import { Pencil, Trash2, Package, Settings as Gear } from 'lucide-react'

interface Category {
  id: number
  name: string
  display_order: number
}

interface MenuItem {
  id: number
  category_id: number
  name: string
  name_en: string
  description: string
  price: number
  image_url: string
  is_available: number
  options: string
  category_name: string
}

export default function MenuManagement() {
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showItemModal, setShowItemModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [savingItem, setSavingItem] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [notification, setNotification] = useState('')
  const [inventoryItems, setInventoryItems] = useState<any[]>([])

  const [itemForm, setItemForm] = useState({
    name: '', nameEn: '', description: '', price: '', categoryId: '', isAvailable: true, options: '[]', inventoryItemId: '', imageUrl: '',
  })

  const [catForm, setCatForm] = useState({ name: '', displayOrder: '0' })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [cats, items, inv] = await Promise.all([
        api.menu.getCategories(),
        api.menu.getAll(),
        api.inventory.getAll(),
      ])
      setCategories(cats)
      setMenuItems(items)
      setInventoryItems(inv)
      if (cats.length > 0) setActiveCategory(cats[0].id)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const showNotify = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(''), 3000)
  }

  const openAddItem = () => {
    setEditingItem(null)
    setItemForm({
      name: '', nameEn: '', description: '', price: '',
      categoryId: activeCategory?.toString() || '', isAvailable: true, options: '[]', inventoryItemId: '', imageUrl: '',
    })
    setShowItemModal(true)
  }

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item)
    setItemForm({
      name: item.name,
      nameEn: item.name_en || '',
      description: item.description || '',
      price: item.price.toString(),
      categoryId: item.category_id?.toString() || '',
      isAvailable: !!item.is_available,
      options: item.options || '[]',
      inventoryItemId: (item as any).inventory_item_id?.toString() || '',
      imageUrl: (item as any).image_url || '',
    })
    setShowItemModal(true)
  }

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingItem(true)
    try {
      const data = {
        name: itemForm.name,
        nameEn: itemForm.nameEn || undefined,
        description: itemForm.description || undefined,
        price: parseFloat(itemForm.price),
        categoryId: itemForm.categoryId ? parseInt(itemForm.categoryId) : undefined,
        isAvailable: itemForm.isAvailable,
        options: itemForm.options ? (() => { try { return JSON.parse(itemForm.options) } catch { return [] } })() : [],
        inventoryItemId: itemForm.inventoryItemId ? parseInt(itemForm.inventoryItemId) : undefined,
        imageUrl: itemForm.imageUrl || undefined,
      }

      if (editingItem) {
        await api.menu.update(editingItem.id, data)
        showNotify('تم تحديث الصنف بنجاح')
      } else {
        await api.menu.create(data)
        showNotify('تم إضافة الصنف بنجاح')
      }
      setShowItemModal(false)
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setSavingItem(false)
    }
  }

  const handleDeleteItem = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return
    try {
      await api.menu.delete(id)
      showNotify('تم حذف الصنف')
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const openAddCategory = () => {
    setEditingCategory(null)
    setCatForm({ name: '', displayOrder: '0' })
    setShowCategoryModal(true)
  }

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat)
    setCatForm({ name: cat.name, displayOrder: cat.display_order.toString() })
    setShowCategoryModal(true)
  }

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingCategory(true)
    try {
      const data = { name: catForm.name, displayOrder: parseInt(catForm.displayOrder) }
      if (editingCategory) {
        await api.menu.updateCategory(editingCategory.id, data)
        showNotify('تم تحديث التصنيف')
      } else {
        await api.menu.createCategory(data)
        showNotify('تم إضافة التصنيف')
      }
      setShowCategoryModal(false)
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setSavingCategory(false)
    }
  }

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا التصنيف؟')) return
    try {
      await api.menu.deleteCategory(id)
      showNotify('تم حذف التصنيف')
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await api.menu.toggleAvailability(item.id, !item.is_available)
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const filteredItems = menuItems.filter(
    (item) => item.category_id === activeCategory || !activeCategory
  )

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">إدارة المنيو</h1>
        <div className="flex gap-2">
          <button onClick={openAddItem} className="btn-primary">+ إضافة صنف</button>
          <button onClick={openAddCategory} className="btn-secondary">+ تصنيف</button>
        </div>
      </div>

      {notification && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg mb-4">
          {notification}
        </div>
      )}

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {cat.name}
            <button
              onClick={(e) => { e.stopPropagation(); openEditCategory(cat) }}
              className="mr-2 opacity-60 hover:opacity-100"
            >
              <Gear size={14} />
            </button>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const options = item.options ? (() => { try { return JSON.parse(item.options) } catch { return [] } })() : []
          return (
            <div key={item.id} className={`card ${!item.is_available ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-lg">{item.name}</h3>
                  {item.name_en && <p className="text-xs text-gray-400">{item.name_en}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditItem(item)} className="text-blue-600 hover:text-blue-800 p-1" title="تعديل"><Pencil size={16} /></button>
                  <button onClick={() => handleDeleteItem(item.id)} className="text-red-600 hover:text-red-800 p-1" title="حذف"><Trash2 size={16} /></button>
                  <button onClick={() => handleToggleAvailability(item)} className={`p-1 ${item.is_available ? 'text-green-600' : 'text-red-600'}`} title={item.is_available ? 'إلغاء التفعيل' : 'تفعيل'}>
                    <span className={`inline-block w-3 h-3 rounded-full ${item.is_available ? 'bg-green-500' : 'bg-red-500'}`} />
                  </button>
                </div>
              </div>
              {item.description && <p className="text-gray-600 text-sm mb-2">{item.description}</p>}
              <p className="text-green-700 font-bold text-lg">{item.price} ج.م</p>
              {(item as any).inventory_item_id && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><Package size={12} /> {(item as any).inventory_name || 'مرتبط بالمخزون'}</p>
              )}
              {options.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  <p>خيارات: {options.map((o: any) => o.name).join('، ')}</p>
                </div>
              )}
            </div>
          )
        })}
        {filteredItems.length === 0 && (
          <p className="col-span-full text-center text-gray-400 py-8">لا توجد أصناف في هذا التصنيف</p>
        )}
      </div>

      {showItemModal && (
        <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingItem ? 'تعديل صنف' : 'إضافة صنف جديد'}</h2>
              <button type="button" onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleItemSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">الاسم (عربي)</label>
                <input className="input-field" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الاسم (إنجليزي)</label>
                <input className="input-field" value={itemForm.nameEn} onChange={(e) => setItemForm({ ...itemForm, nameEn: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الوصف</label>
                <textarea className="input-field" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">السعر (ج.م)</label>
                  <input type="number" step="0.01" className="input-field" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">التصنيف</label>
                  <select className="input-field" value={itemForm.categoryId} onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}>
                    <option value="">بدون تصنيف</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">رابط الصورة</label>
                <input className="input-field" value={itemForm.imageUrl} onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })} placeholder="https://example.com/image.jpg" dir="ltr" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isAvailable" checked={itemForm.isAvailable} onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })} />
                <label htmlFor="isAvailable">متاح</label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ربط بالمخزون (اختياري)</label>
                <select className="input-field" value={itemForm.inventoryItemId} onChange={(e) => setItemForm({ ...itemForm, inventoryItemId: e.target.value })}>
                  <option value="">بدون ربط</option>
                  {inventoryItems.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.name} ({inv.quantity} {inv.unit})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">عند الطلب، سيتم خصم الكمية من المخزون تلقائيًا</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الخيارات (JSON)</label>
                <textarea className="input-field font-mono text-xs" value={itemForm.options} onChange={(e) => setItemForm({ ...itemForm, options: e.target.value })} rows={3} placeholder='[{"name":"حجم كبير","price":55}]' />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={savingItem} className="btn-primary flex-1">{savingItem ? 'جاري الحفظ...' : (editingItem ? 'حفظ التعديلات' : 'إضافة')}</button>
                <button type="button" onClick={() => setShowItemModal(false)} className="btn-secondary">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingCategory ? 'تعديل تصنيف' : 'إضافة تصنيف جديد'}</h2>
              <button type="button" onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleCategorySubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">اسم التصنيف</label>
                <input className="input-field" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الترتيب</label>
                <input type="number" className="input-field" value={catForm.displayOrder} onChange={(e) => setCatForm({ ...catForm, displayOrder: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={savingCategory} className="btn-primary flex-1">{savingCategory ? 'جاري الحفظ...' : (editingCategory ? 'حفظ' : 'إضافة')}</button>
                <button type="button" onClick={() => setShowCategoryModal(false)} className="btn-secondary">إلغاء</button>
              </div>
            </form>
          </div>

        </div>
      )}

    </div>
  )
}
