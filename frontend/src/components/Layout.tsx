import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import { LayoutDashboard, ClipboardList, ShoppingCart, UtensilsCrossed, Package, Wallet, FileBarChart, Settings, LogOut, Menu } from 'lucide-react'

const iconSize = 20

const managerLinks = [
  { to: '/dashboard', label: 'الداش بورد', icon: LayoutDashboard },
  { to: '/orders/new', label: 'تسجيل طلب', icon: ShoppingCart },
  { to: '/orders', label: 'الطلبات', icon: ClipboardList },
  { to: '/menu', label: 'إدارة المنيو', icon: UtensilsCrossed },
  { to: '/inventory', label: 'المخزون', icon: Package },
  { to: '/accounting', label: 'الإدارة', icon: Wallet },
  { to: '/reports', label: 'التقارير', icon: FileBarChart },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
]

const cashierLinks = [
  { to: '/orders/new', label: 'تسجيل طلب', icon: ShoppingCart },
  { to: '/orders', label: 'الطلبات', icon: ClipboardList },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [pendingUsersCount, setPendingUsersCount] = useState(0)
  const [logoUrl, setLogoUrl] = useState('')
  const { user, logout } = useAuth()
  const location = useLocation()

  const links = user?.role === 'manager' ? managerLinks : cashierLinks

  useEffect(() => {
    api.settings.get().then((s: any) => setLogoUrl(s.logo_url || '')).catch((err) => console.error('Failed to load settings:', err))
  }, [location.pathname])

  useEffect(() => {
    let mounted = true
    if (user?.role === 'manager') {
      api.inventory.getLowStock().then((res: any) => { if (mounted) setLowStockCount(res?.length || 0) }).catch((err) => console.error('Failed to load low stock:', err))
      api.auth.getUsers().then((res: any) => { if (mounted) setPendingUsersCount(res?.filter((u: any) => !u.is_active && u.role === 'cashier')?.length || 0) }).catch((err) => console.error('Failed to load users:', err))
    }
    return () => { mounted = false }
  }, [location.pathname])

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 right-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div className="border-b border-gray-100">
          {logoUrl && (
            <div className="flex justify-center px-4 pt-4 pb-2 bg-gradient-to-b from-green-50 to-white">
              <img src={logoUrl} alt="الشعار" className="max-h-16 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; setLogoUrl('') }} />
            </div>
          )}
          <div className="px-4 py-3 text-center">
            <p className="text-sm text-gray-500">{user?.fullName}</p>
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 mt-1">
              {user?.role === 'manager' ? 'مدير' : 'كاشير'}
            </span>
          </div>
        </div>

        <nav className="p-2">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to))
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={iconSize} />
                <span>{link.label}</span>
                {link.to === '/inventory' && lowStockCount > 0 && (
                  <span className="mr-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{lowStockCount}</span>
                )}
                {link.to === '/settings' && pendingUsersCount > 0 && (
                  <span className="mr-auto bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{pendingUsersCount}</span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={iconSize} />
            تسجيل خروج
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="md:hidden mb-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg bg-white shadow"
          >
            <Menu className="w-6 h-6" />
          </button>
          {logoUrl && <img src={logoUrl} alt="الشعار" className="h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; setLogoUrl('') }} />}
        </div>

        <Outlet />
      </main>
    </div>
  )
}
