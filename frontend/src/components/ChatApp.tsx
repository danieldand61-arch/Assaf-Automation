import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'
import { Plus, MessageSquare, Trash2, Send, Loader2, X, Edit2, Check } from 'lucide-react'
import { InputSection } from './InputSection'
import { PreviewSection } from './PreviewSection'
import { LoadingState } from './LoadingState'
import { VideoTranslation } from './VideoTranslation'
import { GoogleAdsGeneration } from './GoogleAdsGeneration'
import { useContentStore } from '../store/contentStore'
import { useApp } from '../contexts/AppContext'
import ReactMarkdown from 'react-markdown'
import Header from './Header'

interface Chat {
  id: string
  title: string
  created_at: string
  last_message_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  created_at: string
  action_type?: 'post_generation' | 'video_dubbing' | 'google_ads' | null
  action_data?: any
}

// Removed ActiveTool type - now using activeToolId per message

export function ChatApp() {
  const { session } = useAuth()
  const { generatedContent, setGeneratedContent } = useContentStore()
  const { t } = useApp()
  
  const [showChat, setShowChat] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [activeToolId, setActiveToolId] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load chats on mount
  useEffect(() => {
    if (session) {
      loadChats()
    }
  }, [session])

  useEffect(() => {
    if (session && activeChat) {
      loadMessages(activeChat.id)
    }
  }, [activeChat])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadChats = async () => {
    if (!session) return
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/chats/list`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to load chats')
      
      const data = await response.json()
      const loadedChats = data.chats || []
      
      // If no chats exist, create first chat automatically
      if (loadedChats.length === 0) {
        await createFirstChat()
        return
      }
      
      setChats(loadedChats)
      setShowChat(true)
      setActiveChat(loadedChats[0])
    } catch (error) {
      console.error('Error loading chats:', error)
    }
  }

  const loadMessages = async (chatId: string) => {
    try {
      console.log('📥 Loading messages for chat:', chatId)
      
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/chats/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to load messages')
      
      const data = await response.json()
      console.log('📥 Received messages:', data.messages)
      
      // Log tool messages specifically
      const toolMessages = (data.messages || []).filter((m: any) => m.role === 'tool')
      console.log('🔧 Tool messages:', toolMessages)
      toolMessages.forEach((tm: any) => {
        console.log(`  - ${tm.id}: action_type=${tm.action_type}, has_content=${!!tm.action_data?.generatedContent}`)
      })
      
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const createFirstChat = async () => {
    if (!session) return null
    
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
      
      // First chat - initialize
      setChats([newChat])
      setActiveChat(newChat)
      setShowChat(true)
      setMessages([])
      
      return newChat
    } catch (error) {
      console.error('Error creating chat:', error)
      return null
    }
  }

  const handleGetStarted = async () => {
    // loadChats will handle creating first chat if needed
    setShowChat(true)
  }

  const createNewChat = async () => {
    if (!session) return
    
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
      
      // Add to existing chats
      setChats(prevChats => [newChat, ...prevChats])
      setActiveChat(newChat)
      setMessages([])
      setActiveToolId(null)
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
      
      const remainingChats = chats.filter(c => c.id !== chatId)
      setChats(remainingChats)
      
      if (activeChat?.id === chatId) {
        if (remainingChats.length > 0) {
          setActiveChat(remainingChats[0])
        } else {
          setActiveChat(null)
          setShowChat(false)
          setMessages([])
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
    }
  }

  const startEditingChat = (chat: Chat) => {
    setEditingChatId(chat.id)
    setEditingTitle(chat.title)
  }

  const saveEditChat = async () => {
    if (!editingChatId || !editingTitle.trim()) return

    try {
      const apiUrl = getApiUrl()
      await fetch(`${apiUrl}/api/chats/${editingChatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ title: editingTitle.trim() })
      })
      
      // Update local state
      setChats(chats.map(c => 
        c.id === editingChatId ? { ...c, title: editingTitle.trim() } : c
      ))
      
      if (activeChat?.id === editingChatId) {
        setActiveChat({ ...activeChat, title: editingTitle.trim() })
      }
      
      setEditingChatId(null)
      setEditingTitle('')
    } catch (error) {
      console.error('Error renaming chat:', error)
    }
  }

  const cancelEditChat = () => {
    setEditingChatId(null)
    setEditingTitle('')
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || !activeChat || !session?.access_token) {
      return
    }

    const userMessage = inputMessage
    setInputMessage('')
    setIsLoading(true)

    try {
      const apiUrl = getApiUrl()
      
      const tempUserMsg: Message = {
        id: 'temp-' + Date.now(),
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, tempUserMsg])

      const response = await fetch(`${apiUrl}/api/chats/${activeChat.id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ content: userMessage })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data.user_message || !data.assistant_message) {
        throw new Error('Invalid response from server')
      }
      
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        data.user_message,
        data.assistant_message
      ])
    } catch (error) {
      console.error('Error sending message:', error)
      alert(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToolClick = async (tool: 'post_generation' | 'video_dubbing' | 'google_ads') => {
    console.log('🎯 handleToolClick called with:', tool)
    console.log('🎯 activeChat:', activeChat)
    console.log('🎯 session:', session ? 'exists' : 'missing')
    
    if (!tool || !activeChat || !session) {
      console.error('❌ Missing required data:', { tool, activeChat: !!activeChat, session: !!session })
      return
    }
    
    try {
      // Save tool message to database
      const apiUrl = getApiUrl()
      console.log('🎯 API URL:', apiUrl)
      
      const toolLabels = {
        'post_generation': `🎨 ${t('generatePost')}`,
        'video_dubbing': `🎬 ${t('aiDubbing')}`,
        'google_ads': `🎯 ${t('generateGoogleAds')}`
      }
      
      const requestBody = {
        content: toolLabels[tool],
        action_type: tool,
        action_data: { status: 'active' }
      }
      
      console.log('🎯 Request body:', requestBody)
      console.log('🎯 Calling endpoint:', `${apiUrl}/api/chats/${activeChat.id}/action`)
      
      const response = await fetch(`${apiUrl}/api/chats/${activeChat.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(requestBody)
      })
      
      console.log('🎯 Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Response error:', errorText)
        throw new Error(`Failed to save tool: ${response.status} ${errorText}`)
      }
      
      const data = await response.json()
      console.log('✅ Tool message created:', data)
      
      const toolMessage = data.action
      
      setMessages(prev => [...prev, toolMessage])
      setActiveToolId(toolMessage.id)
      
      console.log('✅ Tool activated:', toolMessage.id)
    } catch (error) {
      console.error('❌ Error creating tool:', error)
      alert(`Failed to open tool: ${error}`)
    }
  }

  const handleCloseTool = async (toolId: string) => {
    // Save current generated content before closing
    const currentContent = generatedContent
    
    // Get the specific tool message to save its data
    const toolMessage = messages.find(m => m.id === toolId)
    const contentToSave = toolMessage?.action_data?.generatedContent || currentContent
    
    // Update tool message in database
    if (activeChat && session) {
      try {
        const apiUrl = getApiUrl()
        await fetch(`${apiUrl}/api/chats/${activeChat.id}/messages/${toolId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            action_data: { status: 'closed', generatedContent: contentToSave }
          })
        })
      } catch (error) {
        console.error('Error updating tool:', error)
      }
    }
    
    // Mark tool as closed and save its content locally
    setMessages(prev => prev.map(msg => 
      msg.id === toolId 
        ? { ...msg, action_data: { ...msg.action_data, status: 'closed', generatedContent: contentToSave } }
        : msg
    ))
    
    // Clear active tool if it's the one being closed
    if (activeToolId === toolId) {
      setActiveToolId(null)
      setGeneratedContent(null)
    }
  }

  const handleDeleteTool = async (toolId: string) => {
    if (!confirm('Delete this tool and its results? This cannot be undone.')) return
    
    // Delete from database
    if (activeChat && session) {
      try {
        const apiUrl = getApiUrl()
        await fetch(`${apiUrl}/api/chats/${activeChat.id}/messages/${toolId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        })
      } catch (error) {
        console.error('Error deleting tool:', error)
      }
    }
    
    // Remove from local state
    setMessages(prev => prev.filter(msg => msg.id !== toolId))
    
    // Clear active tool if it's the one being deleted
    if (activeToolId === toolId) {
      setActiveToolId(null)
      setGeneratedContent(null)
    }
  }

  const handleReopenTool = (toolId: string) => {
    console.log('🔄 Reopening tool:', toolId)
    
    // Find the message and restore its generated content
    const toolMessage = messages.find(msg => msg.id === toolId)
    console.log('🔄 Tool message found:', toolMessage)
    console.log('🔄 action_data:', toolMessage?.action_data)
    console.log('🔄 generatedContent:', toolMessage?.action_data?.generatedContent)
    
    const savedContent = toolMessage?.action_data?.generatedContent
    
    if (savedContent) {
      console.log('✅ Restoring saved content')
    } else {
      console.log('⚠️ No saved content to restore')
    }
    
    // Reopen closed tool
    setMessages(prev => prev.map(msg => 
      msg.id === toolId 
        ? { ...msg, action_data: { ...msg.action_data, status: 'active' } }
        : msg
    ))
    setActiveToolId(toolId)
    setGeneratedContent(savedContent || null)
  }
  
  const handleActivateTool = (toolId: string) => {
    // Activate tool and load its saved content
    const toolMessage = messages.find(msg => msg.id === toolId)
    const savedContent = toolMessage?.action_data?.generatedContent
    
    setActiveToolId(toolId)
    setGeneratedContent(savedContent || null)
  }

  const handleGenerate = async (formData: any) => {
    if (!activeToolId) return
    
    setIsGenerating(true)
    
    const apiUrl = getApiUrl()
    
    try {
      const response = await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data || !data.variations || data.variations.length === 0) {
        throw new Error('No content generated')
      }
      
      const generatedContent = {
        ...data,
        website_data: data.website_data,
        request_params: formData
      }
      
      // Update tool message in database with generated content
      if (activeChat && session) {
        try {
          await fetch(`${apiUrl}/api/chats/${activeChat.id}/messages/${activeToolId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
              action_data: { status: 'active', generatedContent }
            })
          })
        } catch (error) {
          console.error('Error saving generated content:', error)
        }
      }
      
      // Save generated content to the active tool message locally
      setMessages(prev => prev.map(msg => 
        msg.id === activeToolId 
          ? { ...msg, action_data: { ...msg.action_data, generatedContent } }
          : msg
      ))
      
      // Also update global store for PreviewSection
      setGeneratedContent(generatedContent)
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate content')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReset = () => {
    if (!activeToolId) return
    
    // Clear generated content from the active tool message
    setMessages(prev => prev.map(msg => 
      msg.id === activeToolId 
        ? { ...msg, action_data: { ...msg.action_data, generatedContent: null } }
        : msg
    ))
    
    setGeneratedContent(null)
  }

  // Landing Page
  if (!showChat) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <Header />
        </div>
        
        <div className="flex items-center justify-center p-6 min-h-[calc(100vh-80px)]">
          <div className="max-w-6xl mx-auto text-center">
            <div className="mb-8">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-full inline-block mb-6">
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
              {t('createStunningPosts')}
            </h1>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
              {t('inSecondsNotHours')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-3xl mx-auto">
              {t('transformWebsite')}
            </p>
            </div>
          
            <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {t('generateContent')}
            </button>
          
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              {t('noCreditCard')}
            </p>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full inline-block mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('aiPoweredGeneration')}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('aiPoweredDescription')}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-full inline-block mb-4">
                <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('multiPlatformSupport')}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('multiPlatformDescription')}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
              <div className="bg-pink-100 dark:bg-pink-900/30 p-4 rounded-full inline-block mb-4">
                <svg className="w-8 h-8 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('customImageGeneration')}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('customImageDescription')}</p>
            </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Chat Interface
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition"
          >
            <Plus className="w-5 h-5" />
            {t('newChat')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                if (editingChatId !== chat.id) {
                  setActiveChat(chat)
                  setActiveToolId(null)
                }
              }}
              className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition mb-1 ${
                activeChat?.id === chat.id
                  ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <MessageSquare className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {editingChatId === chat.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEditChat()
                      if (e.key === 'Escape') cancelEditChat()
                    }}
                    onBlur={saveEditChat}
                    className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-purple-300 dark:border-purple-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {chat.title}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                {editingChatId === chat.id ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      saveEditChat()
                    }}
                    className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition"
                  >
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      startEditingChat(chat)
                    }}
                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteChat(chat.id)
                  }}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition"
                >
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <Header />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => {
            // Tool messages - render inline forms
            if (message.role === 'tool') {
              const isActive = activeToolId === message.id
              const isClosed = message.action_data?.status === 'closed'
              
              if (message.action_type === 'post_generation') {
                return (
                  <div key={message.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-2 border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{message.content}</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCloseTool(message.id)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                          title="Minimize"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTool(message.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {isClosed ? (
                      <button
                        onClick={() => handleReopenTool(message.id)}
                        className="w-full text-center text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 py-8 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition"
                      >
                        {t('clickToReopenTool')}
                      </button>
                    ) : isActive && isGenerating ? (
                      <LoadingState />
                    ) : isActive && generatedContent ? (
                      <PreviewSection onReset={handleReset} />
                    ) : isActive ? (
                      <InputSection onGenerate={handleGenerate} />
                    ) : (
                      <button
                        onClick={() => handleActivateTool(message.id)}
                        className="w-full text-center text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 py-8 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition"
                      >
                        {t('clickToUseTool')}
                      </button>
                    )}
                  </div>
                )
              }
              
              if (message.action_type === 'video_dubbing') {
                return (
                  <div key={message.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-2 border-pink-200 dark:border-pink-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{message.content}</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCloseTool(message.id)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                          title="Minimize"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTool(message.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {isClosed ? (
                      <button
                        onClick={() => handleReopenTool(message.id)}
                        className="w-full text-center text-gray-500 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 py-8 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition"
                      >
                        {t('clickToReopenTool')}
                      </button>
                    ) : isActive ? (
                      <VideoTranslation />
                    ) : (
                      <button
                        onClick={() => handleActivateTool(message.id)}
                        className="w-full text-center text-gray-500 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 py-8 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition"
                      >
                        {t('clickToUseTool')}
                      </button>
                    )}
                  </div>
                )
              }
              
              if (message.action_type === 'google_ads') {
                const handleGoogleAdsGenerate = async (adsPackage: any) => {
                  // Save Google Ads results to message action_data
                  const updatedMessages = messages.map(msg => 
                    msg.id === message.id 
                      ? { ...msg, action_data: { ...msg.action_data, generatedContent: adsPackage } }
                      : msg
                  )
                  setMessages(updatedMessages)
                  
                  // Also save to database
                  if (activeChat && session) {
                    try {
                      const apiUrl = getApiUrl()
                      await fetch(`${apiUrl}/api/chats/${activeChat.id}/messages/${message.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session?.access_token}`
                        },
                        body: JSON.stringify({
                          action_data: { status: 'active', generatedContent: adsPackage }
                        })
                      })
                      console.log('✅ Google Ads results saved to database')
                    } catch (error) {
                      console.error('Error saving Google Ads results:', error)
                    }
                  }
                }
                
                return (
                  <div key={message.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-2 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{message.content}</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCloseTool(message.id)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                          title="Minimize"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTool(message.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {isClosed ? (
                      <button
                        onClick={() => handleReopenTool(message.id)}
                        className="w-full text-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-8 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                      >
                        {t('clickToReopenTool')}
                      </button>
                    ) : isActive ? (
                      <GoogleAdsGeneration 
                        onGenerate={handleGoogleAdsGenerate}
                        initialData={message.action_data?.generatedContent}
                      />
                    ) : (
                      <button
                        onClick={() => handleActivateTool(message.id)}
                        className="w-full text-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-8 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                      >
                        {t('clickToUseTool')}
                      </button>
                    )}
                  </div>
                )
              }
            }
            
            // Regular messages
            return (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl px-6 py-4 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                          em: ({node, ...props}) => <em className="italic" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2" {...props} />,
                          li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            )
          })}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-2xl shadow-md">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={t('typeMessage')}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tool Buttons */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleToolClick('video_dubbing')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-pink-100 dark:hover:bg-pink-900/30 hover:text-pink-700 dark:hover:text-pink-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {t('aiDubbing')}
              </button>
              <button
                onClick={() => handleToolClick('post_generation')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('generatePost')}
              </button>
              <button
                onClick={() => handleToolClick('google_ads')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('generateGoogleAds')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
