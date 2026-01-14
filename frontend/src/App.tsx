import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from './components/Header'
import { LandingPage } from './components/LandingPage'
import { InputSection } from './components/InputSection'
import { PreviewSection } from './components/PreviewSection'
import { LoadingState } from './components/LoadingState'
import { useContentStore } from './store/contentStore'
import { useApp } from './contexts/AppContext'
import { useAuth } from './contexts/AuthContext'
import './App.css'

function App() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isGenerating, setIsGenerating] = useState(false)
  const [showInputForm, setShowInputForm] = useState(false)
  const { generatedContent, setGeneratedContent } = useContentStore()
  const { t } = useApp()

  const handleGenerate = async (formData: any) => {
    // Check if user is logged in
    if (!user) {
      alert('Please sign in to generate content')
      navigate('/login')
      return
    }
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
    setShowInputForm(false)
  }

  const handleGetStarted = () => {
    if (!user) {
      navigate('/login')
      return
    }
    setShowInputForm(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isGenerating ? (
          <LoadingState />
        ) : generatedContent ? (
          <PreviewSection onReset={handleReset} />
        ) : showInputForm ? (
          <InputSection onGenerate={handleGenerate} />
        ) : (
          <LandingPage onGetStarted={handleGetStarted} />
        )}
      </main>
    </div>
  )
}

export default App

