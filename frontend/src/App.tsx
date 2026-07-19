import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import MenuManagement from './pages/MenuManagement'
import OrderScreen from './pages/OrderScreen'
import Accounting from './pages/Accounting'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import OrdersPage from './pages/OrdersPage'
import InventoryPage from './pages/InventoryPage'
import SubscriptionExpired from './pages/SubscriptionExpired'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <ErrorBoundary>
      <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={
          user?.role === 'cashier'
            ? <Navigate to="/orders/new" replace />
            : <Navigate to="/dashboard" replace />
        } />
        <Route path="dashboard" element={
          <ProtectedRoute allowedRoles={['manager']}><Dashboard /></ProtectedRoute>
        } />
        <Route path="menu" element={
          <ProtectedRoute allowedRoles={['manager']}><MenuManagement /></ProtectedRoute>
        } />
        <Route path="orders/new" element={
          <ProtectedRoute allowedRoles={['manager', 'cashier']}><OrderScreen /></ProtectedRoute>
        } />
        <Route path="orders" element={
          <ProtectedRoute allowedRoles={['manager', 'cashier']}><OrdersPage /></ProtectedRoute>
        } />
        <Route path="inventory" element={
          <ProtectedRoute allowedRoles={['manager']}><InventoryPage /></ProtectedRoute>
        } />
        <Route path="accounting" element={
          <ProtectedRoute allowedRoles={['manager']}><Accounting /></ProtectedRoute>
        } />
        <Route path="reports" element={
          <ProtectedRoute allowedRoles={['manager']}><Reports /></ProtectedRoute>
        } />
        <Route path="settings" element={
          <ProtectedRoute allowedRoles={['manager']}><Settings /></ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      <Route path="/subscription-expired" element={<SubscriptionExpired />} />
    </Routes>
      </ErrorBoundary>
    </ToastProvider>
  )
}

export default App
