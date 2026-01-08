import { Sparkles } from 'lucide-react'

export function LoadingState() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
        <div className="flex justify-center mb-6">
          <Sparkles className="w-16 h-16 text-blue-600 animate-pulse" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Generating Content...
        </h2>
        
        <div className="space-y-3 text-gray-600">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          
          <div className="text-sm space-y-2 mt-6">
            <p>✅ Analyzing website...</p>
            <p>✅ Extracting brand information...</p>
            <p>🔄 Generating post texts...</p>
            <p>⏳ Creating images...</p>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 mt-8">
          This may take 30-60 seconds
        </p>
      </div>
    </div>
  )
}

