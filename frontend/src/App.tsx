import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from './components/Header'
import { LandingPage } from './components/LandingPage'
import { InputSection } from './components/InputSection'
import { PreviewSection } from './components/PreviewSection'
import { LoadingState } from './components/LoadingState'
import { VideoTranslation } from './components/VideoTranslation'
import { useContentStore } from './store/contentStore'
import { useApp } from './contexts/AppContext'
import { useAuth } from './contexts/AuthContext'
import { getApiUrl } from './lib/api'
import './App.css'

type ActiveTab = 'landing' | 'content' | 'video'

function App() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('landing')
  const { generatedContent, setGeneratedContent } = useContentStore()
  const { t } = useApp()
  
  // Force rebuild to clear Vercel cache

  const handleGenerate = async (formData: any) => {
    setIsGenerating(true)
    
    const apiUrl = getApiUrl()
    
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
      
      // Store website_data and request params for editing
      setGeneratedContent({
        ...data,
        website_data: data.website_data,
        request_params: formData
      })
    } catch (error) {
      console.error('❌ Generation error:', error)
      alert(`${t('generationError')}\n\nDetails: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReset = () => {
    setGeneratedContent(null)
    setActiveTab('content')
  }

  const handleGetStarted = () => {
    setActiveTab('content')
  }

  const handleTabChange = (tab: ActiveTab) => {
    if (!user && tab === 'video') {
      alert('Please sign in to access this feature')
      navigate('/login')
      return
    }
    setActiveTab(tab)
    if (tab === 'content') {
      setGeneratedContent(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header />
      
      {/* Tab Navigation - show only when logged in and not on landing */}
      {user && activeTab !== 'landing' && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-2">
              <button
                onClick={() => handleTabChange('content')}
                className={`
                  px-6 py-3 font-medium transition-all border-b-2
                  ${activeTab === 'content'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }
                `}
              >
                📝 Content Generation
              </button>
              <button
                onClick={() => handleTabChange('video')}
                className={`
                  px-6 py-3 font-medium transition-all border-b-2
                  ${activeTab === 'video'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }
                `}
              >
                🎬 Video Translation
              </button>
            </div>
          </div>
        </div>
      )}
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'landing' && (
          <LandingPage onGetStarted={handleGetStarted} />
        )}

        {activeTab === 'content' && (
          isGenerating ? (
            <LoadingState />
          ) : generatedContent ? (
            <PreviewSection onReset={handleReset} />
          ) : (
            <InputSection onGenerate={handleGenerate} />
          )
        )}

        {activeTab === 'video' && (
          <VideoTranslation />
        )}
      </main>
    </div>
  )
}

export default App

