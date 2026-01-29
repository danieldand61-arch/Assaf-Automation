import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'
import { Plus, MessageSquare, Trash2 } from 'lucide-react'
import Header from './Header'
import { LandingPage } from './LandingPage'
import { InputSection } from './InputSection'
import { PreviewSection } from './PreviewSection'
import { LoadingState } from './LoadingState'
import { VideoTranslation } from './VideoTranslation'
import { useContentStore } from '../store/contentStore'
import { useApp } from '../contexts/AppContext'

interface Chat {
  id: string
  title: string
  created_at: string
  last_message_at: string
  message_count: number
}

type ActiveTab = 'landing' | 'content' | 'video'

export function AppWithChat() {
  const { session } = useAuth()
  const { generatedContent, setGeneratedContent } = useContentStore()
  const { t } = useApp()
  
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('landing')

  useEffect(() => {
    if (session) {
      loadChats()
    }
  }, [session])

  const loadChats = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/chats/list`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to load chats')
      
      const data = await response.json()
      setChats(data.chats || [])
      
      // Auto-select first chat or create new one
      if (data.chats?.length > 0 && !activeChat) {
        setActiveChat(data.chats[0])
      } else if (data.chats?.length === 0) {
        createNewChat()
      }
    } catch (error) {
      console.error('Error loading chats:', error)
    }
  }

  const createNewChat = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/chats/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ title: 'New Chat' })
      })
      
      if (!response.ok) throw new Error('Failed to create chat')
      
      const data = await response.json()
      const newChat = data.chat
      
      setChats([newChat, ...chats])
      setActiveChat(newChat)
      setGeneratedContent(null)
      setActiveTab('landing')
    } catch (error) {
      console.error('Error creating chat:', error)
    }
  }

  const deleteChat = async (chatId: string) => {
    if (!confirm('Delete this chat?')) return

    try {
      const apiUrl = getApiUrl()
      await fetch(`${apiUrl}/api/chats/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      setChats(chats.filter(c => c.id !== chatId))
      
      if (activeChat?.id === chatId) {
        const remainingChats = chats.filter(c => c.id !== chatId)
        if (remainingChats.length > 0) {
          setActiveChat(remainingChats[0])
        } else {
          createNewChat()
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
    }
  }

  const handleGenerate = async (formData: any) => {
    setIsGenerating(true)
    
    const apiUrl = getApiUrl()
    
    try {
      const response = await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Server returned ${response.status}: ${errorText}`)
      }
      
      const data = await response.json()
      
      if (!data || !data.variations || data.variations.length === 0) {
        throw new Error('No content generated')
      }
      
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

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition"
          >
            <Plus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveChat(chat)}
              className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition mb-1 ${
                activeChat?.id === chat.id
                  ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <MessageSquare className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {chat.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {chat.message_count} messages
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteChat(chat.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition"
              >
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with sidebar toggle */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 px-4 py-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Header />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'landing' && <LandingPage onGetStarted={handleGetStarted} />}
          
          {activeTab === 'content' && (
            <>
              {isGenerating ? (
                <LoadingState />
              ) : generatedContent ? (
                <PreviewSection onReset={handleReset} />
              ) : (
                <InputSection onGenerate={handleGenerate} />
              )}
            </>
          )}
          
          {activeTab === 'video' && <VideoTranslation />}
        </div>

        {/* Tab Navigation */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex justify-center gap-2 p-4">
            <button
              onClick={() => setActiveTab('content')}
              className={`px-6 py-3 rounded-lg font-medium transition ${
                activeTab === 'content'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              📝 Generate Post
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`px-6 py-3 rounded-lg font-medium transition ${
                activeTab === 'video'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              🎬 AI Dubbing
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
