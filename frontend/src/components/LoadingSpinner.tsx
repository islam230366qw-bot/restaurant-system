export default function LoadingSpinner({ message = 'جاري التحميل...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto"></div>
        <p className="mt-3 text-gray-600">{message}</p>
      </div>
    </div>
  )
}
