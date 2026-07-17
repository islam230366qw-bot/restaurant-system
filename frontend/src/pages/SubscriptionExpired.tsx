import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function SubscriptionExpired() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('انتهت صلاحية الاشتراك')

  useEffect(() => {
    localStorage.removeItem('subscription_expired')
    api.auth.refresh().then((ok) => {
      if (ok) navigate('/')
    })
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">الاشتراك منتهي</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <p className="text-sm text-gray-400 mb-6">يرجى التواصل مع الإدارة لتجديد الاشتراك</p>
        <button
          onClick={() => window.location.href = '/login'}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          العودة لتسجيل الدخول
        </button>
      </div>
    </div>
  )
}
