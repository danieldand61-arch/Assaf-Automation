import { useState } from 'react'
import { Sparkles, Instagram, Facebook } from 'lucide-react'
import { InputSection } from './components/InputSection'
import { PreviewSection } from './components/PreviewSection'
import { LoadingState } from './components/LoadingState'
import { useContentStore } from './store/contentStore'
import './App.css'

function App() {
  const [isGenerating, setIsGenerating] = useState(false)
  const { generatedContent, setGeneratedContent } = useContentStore()

  const handleGenerate = async (formData: any) => {
    setIsGenerating(true)
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    
    try {
      const response = await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      setGeneratedContent(data)
    } catch (error) {
      console.error('Generation error:', error)
      alert('Generation error. Check backend and API key.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Social Media AI Generator
            </h1>
          </div>
          <div className="flex gap-2">
            <Facebook className="w-6 h-6 text-blue-600" />
            <Instagram className="w-6 h-6 text-pink-600" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {!generatedContent && !isGenerating && (
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Create Professional Posts in Seconds
            </h2>
            <p className="text-gray-600">
              Enter a website URL and keywords — get ready-made posts with images
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

      {/* Footer */}
      <footer className="mt-16 text-center text-gray-500 text-sm pb-6">
        Powered by Google Gemini 2.5 Pro & Nano Banana 🍌
      </footer>
    </div>
  )
}

export default App

