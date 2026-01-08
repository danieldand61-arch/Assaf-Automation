import { useState } from 'react'
import Header from './components/Header'
import { InputSection } from './components/InputSection'
import { PreviewSection } from './components/PreviewSection'
import { LoadingState } from './components/LoadingState'
import { useContentStore } from './store/contentStore'
import { useApp } from './contexts/AppContext'
import './App.css'

function App() {
  const [isGenerating, setIsGenerating] = useState(false)
  const { generatedContent, setGeneratedContent } = useContentStore()
  const { t } = useApp()

  const handleGenerate = async (formData: any) => {
    setIsGenerating(true)
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    
    console.log('🚀 Starting generation...')
    console.log('📍 API URL:', apiUrl)
    console.log('📦 Form data:', formData)
    
    try {
      const response = await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      console.log('📥 Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Server error:', errorText)
        throw new Error(`Server returned ${response.status}: ${errorText}`)
      }
      
      const data = await response.json()
      console.log('✅ Data received:', data)
      
      if (!data || !data.variations || data.variations.length === 0) {
        throw new Error('No content generated')
      }
      
      setGeneratedContent(data)
    } catch (error) {
      console.error('❌ Generation error:', error)
      alert(`${t('generationError')}\n\nDetails: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors">
      <Header />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {!generatedContent && !isGenerating && (
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
              {t('heroTitle')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {t('heroSubtitle')}
            </p>
          </div>
        )}

        {isGenerating ? (
          <LoadingState />
        ) : generatedContent ? (
          <PreviewSection onReset={() => setGeneratedContent(null)} />
        ) : (
          <InputSection onGenerate={handleGenerate} />
        )}
      </main>
    </div>
  )
}

export default App

