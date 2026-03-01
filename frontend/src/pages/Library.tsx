import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { SavedPostsLibrary } from '../components/SavedPostsLibrary'
import { Archive, MessageSquare } from 'lucide-react'
import { getApiUrl } from '../lib/api'

interface ChatItem {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

function ChatHistoryTab() {
  const { session } = useAuth()
  const [chats, setChats] = useState<ChatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedChat, setExpandedChat] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null)

  useEffect(() => { if (session) fetchChats() }, [session])

  const fetchChats = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/chats/list`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setChats(data.chats || [])
    } catch (e) { console.error('Fetch chats:', e) }
    finally { setLoading(false) }
  }

  const loadMessages = async (chatId: string) => {
    if (messages[chatId]) { setExpandedChat(expandedChat === chatId ? null : chatId); return }
    setLoadingMessages(chatId)
    setExpandedChat(chatId)
    try {
      const res = await fetch(`${getApiUrl()}/api/chats/${chatId}/messages`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setMessages(prev => ({ ...prev, [chatId]: data.messages || [] }))
    } catch (e) { console.error('Fetch messages:', e) }
    finally { setLoadingMessages(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
    </div>
  )

  if (chats.length === 0) return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-16 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
        <MessageSquare className="w-8 h-8 text-purple-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Chat History Yet</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        Start a conversation with the AI Advisor to see your chat history here
      </p>
    </div>
  )

  return (
    <div className="space-y-3">
      {chats.map(chat => (
        <div key={chat.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
          <button onClick={() => loadMessages(chat.id)}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
              <MessageSquare size={18} className="text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{chat.title || 'Untitled Chat'}</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{new Date(chat.updated_at || chat.created_at).toLocaleDateString()} · {new Date(chat.updated_at || chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedChat === chat.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedChat === chat.id && (
            <div className="border-t border-gray-100 dark:border-gray-700 p-4 max-h-80 overflow-y-auto space-y-3">
              {loadingMessages === chat.id ? (
                <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" /></div>
              ) : (messages[chat.id] || []).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No messages</p>
              ) : (
                (messages[chat.id] || []).map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                    }`}>
                      {msg.content.length > 300 ? msg.content.slice(0, 300) + '...' : msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function Library() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'posts' | 'chats'>('posts')

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('posts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            tab === 'posts' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          <Archive size={16} /> Saved Posts
        </button>
        <button onClick={() => setTab('chats')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            tab === 'chats' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          <MessageSquare size={16} /> AI Chat History
        </button>
      </div>

      {tab === 'posts' ? <SavedPostsLibrary /> : <ChatHistoryTab />}
    </div>
  )
}
