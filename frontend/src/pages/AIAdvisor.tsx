import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, TrendingUp, AlertTriangle, Trash2, Plus, MessageSquare, ChevronLeft, ChevronRight, BarChart3, RefreshCw, Eye } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getJoyoTheme } from '../styles/joyo-theme'
import { getApiUrl } from '../lib/api'

interface Message { role: 'user' | 'assistant'; content: string }
interface ChatItem { id: string; title: string; created_at: string; updated_at: string; message_count?: number }

const STRATEGY_CHIPS = [
  { icon: BarChart3, text: 'Analyze my Customer Acquisition Cost (CAC)' },
  { icon: RefreshCw, text: 'Develop a Re-targeting Roadmap' },
  { icon: Eye, text: 'Audit my Brand Tone Consistency' },
  { icon: TrendingUp, text: 'Build a Growth Flywheel strategy' },
]

function renderMarkdown(text: string): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/^### (.+)$/gm, '<div style="font-size:15px;font-weight:700;margin:12px 0 4px">$1</div>')
  html = html.replace(/^## (.+)$/gm, '<div style="font-size:16px;font-weight:700;margin:14px 0 6px">$1</div>')
  html = html.replace(/^# (.+)$/gm, '<div style="font-size:17px;font-weight:700;margin:16px 0 6px">$1</div>')
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.08);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
  html = html.replace(/^[-•]\s+(.+)$/gm, '<div style="padding-left:14px">• $1</div>')
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<div style="padding-left:14px">$1. $2</div>')
  return html
}

export default function AIAdvisor() {
  const { session } = useAuth()
  const { theme } = useTheme()
  const t = getJoyoTheme(theme)
  const api = getApiUrl()

  const [chats, setChats] = useState<ChatItem[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingChats, setLoadingChats] = useState(true)
  const [hasAds, setHasAds] = useState<boolean | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const headers = session ? { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } : {}

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Load chat list on mount
  useEffect(() => {
    if (!session) return
    fetchChats()
    checkAds()
  }, [session])

  const fetchChats = async () => {
    try {
      const res = await fetch(`${api}/api/chats/list`, { headers: headers as any })
      if (res.ok) {
        const data = await res.json()
        setChats(data.chats || [])
      }
    } catch { /* silent */ }
    finally { setLoadingChats(false) }
  }

  const checkAds = async () => {
    try {
      const res = await fetch(`${api}/api/analytics/sync-status`, { headers: headers as any })
      if (res.ok) { const d = await res.json(); setHasAds(d.syncs?.length > 0) }
      else setHasAds(false)
    } catch { setHasAds(false) }
  }

  const loadChat = async (chatId: string) => {
    setActiveChatId(chatId)
    setMessages([])
    try {
      const res = await fetch(`${api}/api/chats/${chatId}/messages`, { headers: headers as any })
      if (res.ok) {
        const data = await res.json()
        const msgs: Message[] = (data.messages || [])
          .filter((m: any) => m.role !== 'system')
          .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        setMessages(msgs)
      }
    } catch { /* silent */ }
  }

  const createNewChat = () => {
    setActiveChatId(null)
    setMessages([])
    setInput('')
  }

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this chat?')) return
    try {
      await fetch(`${api}/api/chats/${chatId}`, { method: 'DELETE', headers: headers as any })
      setChats(prev => prev.filter(c => c.id !== chatId))
      if (activeChatId === chatId) createNewChat()
    } catch { /* silent */ }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || !session) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      let cid = activeChatId
      if (!cid) {
        const createRes = await fetch(`${api}/api/chats/create`, {
          method: 'POST', headers: headers as any,
          body: JSON.stringify({ title: text.slice(0, 50) }),
        })
        if (!createRes.ok) throw new Error(`Create chat failed: ${createRes.status}`)
        const createData = await createRes.json()
        cid = createData.chat?.id || createData.chat_id || createData.id
        if (!cid) throw new Error('No chat ID returned')
        setActiveChatId(cid)
        fetchChats()
      }

      const msgRes = await fetch(`${api}/api/chats/${cid}/message`, {
        method: 'POST', headers: headers as any,
        body: JSON.stringify({ content: text.trim(), mode: 'advisor' }),
      })
      if (!msgRes.ok) throw new Error(`Message failed: ${msgRes.status}`)
      const msgData = await msgRes.json()
      const reply = msgData.assistant_message?.content || msgData.response || msgData.message || 'No response received.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message || 'Connection failed.'}` }])
    } finally {
      setLoading(false)
    }
  }

  const activeChat = chats.find(c => c.id === activeChatId)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', height: 'calc(100vh - 120px)', display: 'flex', gap: 0 }}>
      {/* Chat History Sidebar */}
      <div style={{
        width: sidebarOpen ? 260 : 0, minWidth: sidebarOpen ? 260 : 0,
        transition: 'all 0.25s ease', overflow: 'hidden',
        background: t.card, borderRadius: '16px 0 0 16px', border: `1px solid ${t.border}`, borderRight: 'none',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 14px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={createNewChat} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 12px', borderRadius: 10, border: 'none',
            background: t.gradient1, color: 'white', fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
          }}>
            <Plus size={14} /> New Chat
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {loadingChats ? (
            <div style={{ textAlign: 'center', padding: 20, color: t.textMuted, fontSize: 12 }}>Loading...</div>
          ) : chats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: t.textMuted, fontSize: 12 }}>No chats yet</div>
          ) : (
            chats.map(chat => (
              <div key={chat.id}
                onClick={() => loadChat(chat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                  background: activeChatId === chat.id ? `${t.accent}18` : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <MessageSquare size={14} style={{ color: activeChatId === chat.id ? t.accent : t.textMuted, flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: 12, fontWeight: activeChatId === chat.id ? 600 : 500,
                    color: activeChatId === chat.id ? t.text : t.textSecondary,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {chat.title || 'Untitled'}
                  </div>
                  <div style={{ fontSize: 10, color: t.textMuted }}>
                    {new Date(chat.updated_at || chat.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button onClick={(e) => deleteChat(chat.id, e)}
                  style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, opacity: 0.4, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                >
                  <Trash2 size={12} style={{ color: t.danger }} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sidebar toggle */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
        width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: t.card, border: `1px solid ${t.border}`, borderLeft: sidebarOpen ? 'none' : undefined,
        borderRadius: sidebarOpen ? 0 : '8px 0 0 8px', cursor: 'pointer', color: t.textMuted
      }}>
        {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: t.card, borderRadius: sidebarOpen ? '0 16px 0 0' : '16px 16px 0 0',
          border: `1px solid ${t.border}`, borderBottom: 'none',
        }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>
              {activeChat?.title || 'Strategic Advisor'}
            </h1>
            <p style={{ fontSize: 11.5, color: t.textMuted }}>
              {activeChatId ? `Chat started ${new Date(activeChat?.created_at || '').toLocaleDateString()}` : 'Elite CMO at your service'}
            </p>
          </div>
        </div>

        {hasAds === false && (
          <div style={{
            margin: '0 18px', padding: '10px 14px', borderRadius: 10,
            background: `${t.warning}15`, border: `1px solid ${t.warning}30`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlertTriangle size={14} style={{ color: t.warning, flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: t.text, margin: 0 }}>
              No ad platforms connected. Connect in <strong>Integrations</strong> for real campaign analysis.
            </p>
          </div>
        )}

        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 18px',
          background: t.surfaceSecondary, border: `1px solid ${t.border}`, borderTop: 'none',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20,
                background: `linear-gradient(135deg, ${t.accent}20, rgba(139,92,246,0.15))`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 8px 32px ${t.accent}15`,
              }}>
                <Sparkles size={28} style={{ color: t.accent }} />
              </div>
              <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 6, letterSpacing: -0.5 }}>
                  What's your strategic challenge today?
                </h3>
                <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>
                  Your elite CMO is ready. Ask about growth strategy, campaign optimization, or brand positioning.
                </p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 520 }}>
                {STRATEGY_CHIPS.map((chip, i) => (
                  <button key={i} onClick={() => sendMessage(chip.text)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                    borderRadius: 24, border: `1px solid ${t.border}`, background: t.card,
                    color: t.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}>
                    <chip.icon size={14} style={{ color: t.accent }} />
                    {chip.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'user' ? (
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: 16,
                  background: t.accent, color: '#fff', fontSize: 13, lineHeight: 1.6,
                }}>{msg.content}</div>
              ) : (
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 16,
                  background: t.card, color: t.text, border: `1px solid ${t.border}`, fontSize: 13, lineHeight: 1.6,
                }} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: 16, background: t.card, border: `1px solid ${t.border}` }}>
                <Loader2 size={16} className="animate-spin" style={{ color: t.accent }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{
          padding: '12px 18px', display: 'flex', gap: 8,
          background: t.card, borderRadius: sidebarOpen ? '0 0 16px 0' : '0 0 16px 16px',
          border: `1px solid ${t.border}`, borderTop: 'none',
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="What's your strategic challenge today?"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 13, outline: 'none',
              background: t.surfaceSecondary, border: `1px solid ${t.border}`, color: t.text,
            }}
          />
          <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} style={{
            padding: '10px 16px', borderRadius: 10, border: 'none',
            background: t.gradient1, color: 'white', cursor: 'pointer', opacity: loading || !input.trim() ? 0.4 : 1,
          }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
