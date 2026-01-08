import { Sparkles } from 'lucide-react'
import { useApp } from '../contexts/AppContext'

export function LoadingState() {
  const { t } = useApp()
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 text-center">
        <div className="flex justify-center mb-6">
          <Sparkles className="w-16 h-16 text-blue-600 dark:text-blue-400 animate-pulse" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
          {t('generating')}
        </h2>
        
        <div className="space-y-3 text-gray-600 dark:text-gray-400">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          
          <div className="text-sm space-y-2 mt-6">
            <p>✅ {t('analyzingWebsite')}</p>
            <p>✅ {t('extractingBrand')}</p>
            <p>🔄 {t('generatingTexts')}</p>
            <p>⏳ {t('creatingImages')}</p>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-8">
          {t('timeEstimate')}
        </p>
      </div>
    </div>
  )
}

