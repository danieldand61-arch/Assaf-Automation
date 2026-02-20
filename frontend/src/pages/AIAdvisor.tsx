import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, TrendingUp, Target, DollarSign, Users, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getJoyoTheme } from '../styles/joyo-theme'
import { getApiUrl } from '../lib/api'

interface Message { role: 'user' | 'assistant'; content: string }

const QUICK_PROMPTS = [
  { icon: TrendingUp, text: 'How were my campaigns this week?' },
  { icon: Target, text: 'Which campaign should I scale up?' },
  { icon: DollarSign, text: 'Where am I wasting budget?' },
  { icon: Users, text: 'How can I improve my targeting?' },
  { icon: Zap, text: 'Give me 3 quick wins for better ROI' },
  { icon: Sparkles, text: 'Write me a strategy for next month' },
]

export default function AIAdvisor() {
  const { session } = useAuth()
  const { theme } = useTheme()
  const t = getJoyoTheme(theme)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const api = getApiUrl()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || !session) return
    const headers = { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
    const userMsg: Message = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      let cid = chatId
      if (!cid) {
        const createRes = await fetch(`${api}/api/chats/create`, {
          method: 'POST', headers,
          body: JSON.stringify({ title: text.slice(0, 50) }),
        })
        if (!createRes.ok) {
          const err = await createRes.text()
          console.error('Chat create failed:', createRes.status, err)
          throw new Error(`Create chat failed: ${createRes.status}`)
        }
        const createData = await createRes.json()
        cid = createData.chat?.id || createData.chat_id || createData.id
        if (!cid) {
          console.error('No chat ID returned:', createData)
          throw new Error('No chat ID returned')
        }
        setChatId(cid)
      }

      const msgRes = await fetch(`${api}/api/chats/${cid}/message`, {
        method: 'POST', headers,
        body: JSON.stringify({ content: text.trim(), mode: 'advisor' }),
      })
      if (!msgRes.ok) {
        const err = await msgRes.text()
        console.error('Chat message failed:', msgRes.status, err)
        throw new Error(`Message failed: ${msgRes.status}`)
      }
      const msgData = await msgRes.json()
      const reply = msgData.assistant_message?.content || msgData.response || msgData.message || 'No response received.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e: any) {
      console.error('AI Advisor error:', e)
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message || 'Connection failed. Please try again.'}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: t.text }}>AI Advisor</h1>
        <p className="text-sm" style={{ color: t.textSecondary }}>Ask me anything about your campaigns, strategy, and performance</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-2xl p-4 space-y-4" style={{ background: t.surfaceSecondary, border: `1px solid ${t.border}` }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${t.accent}15` }}>
              <Sparkles size={28} style={{ color: t.accent }} />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold mb-1" style={{ color: t.text }}>How can I help?</h3>
              <p className="text-sm" style={{ color: t.textMuted }}>Ask about your campaigns or pick a question below</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {QUICK_PROMPTS.map((qp, i) => (
                <button key={i} onClick={() => sendMessage(qp.text)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left transition hover:scale-[1.02]"
                  style={{ background: t.card, border: `1px solid ${t.border}`, color: t.text }}>
                  <qp.icon size={16} style={{ color: t.accent, flexShrink: 0 }} />
                  {qp.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                background: msg.role === 'user' ? t.accent : t.card,
                color: msg.role === 'user' ? '#fff' : t.text,
                border: msg.role === 'assistant' ? `1px solid ${t.border}` : 'none',
              }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl" style={{ background: t.card, border: `1px solid ${t.border}` }}>
              <Loader2 size={16} className="animate-spin" style={{ color: t.accent }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="Ask about your campaigns..."
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: t.card, border: `1px solid ${t.border}`, color: t.text }}
        />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          className="px-4 py-3 rounded-xl text-white font-semibold disabled:opacity-40 transition"
          style={{ background: t.gradient1 }}>
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
