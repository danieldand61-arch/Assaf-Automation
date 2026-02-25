import { useState, useEffect, useRef } from 'react'
import { Send, Target, ArrowUp, ArrowDown, Film, Coins, Zap, MessageSquare, Image, Video, Megaphone, Lightbulb, TrendingUp, FileText, Rocket, Palette, BarChart3, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getJoyoTheme } from '../styles/joyo-theme'
import { getApiUrl } from '../lib/api'

interface DashboardProps {
  onNavigate: (tab: string) => void
}

interface MetricCardProps {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  change?: string
  changeDir?: 'up' | 'down'
  color: string
  delay?: number
}

function MetricCard({ icon: Icon, label, value, sub, change, changeDir, color, delay = 0 }: MetricCardProps) {
  const { theme } = useTheme()
  const t = getJoyoTheme(theme)

  return (
    <div style={{
      background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
      transition: 'all 0.25s ease', padding: '20px 22px', flex: 1, minWidth: 170,
      position: 'relative', overflow: 'hidden', animation: `fadeUp 0.5s ease ${delay}s both`
    }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: '50%', background: `${color}10` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={17} color={color} />
        </div>
        <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: -1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 4 }}>{sub}</div>}
      {change && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, marginTop: 6,
          fontSize: 11.5, fontWeight: 600, color: changeDir === 'up' ? t.success : t.danger
        }}>
          {changeDir === 'up' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
          {change}
        </div>
      )}
    </div>
  )
}

// Service label/icon/color mapping (same IDs as credits_usage.service_type)
const SERVICE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  social_posts:          { label: 'Social Posts',     icon: Send,      color: '#4A7CFF' },
  image_generation:      { label: 'Image Generation', icon: Image,     color: '#8B5CF6' },
  google_ads:            { label: 'Google Ads',       icon: Megaphone, color: '#10B981' },
  video_dubbing:         { label: 'Video Dubbing',    icon: Video,     color: '#F59E0B' },
  video_dubbing_actual:  { label: 'Video Dubbing',    icon: Video,     color: '#F59E0B' },
  video_generation:      { label: 'Video Generation', icon: Film,      color: '#EC4899' },
  gemini_chat:           { label: 'AI Chat',          icon: MessageSquare, color: '#14B8A6' },
  chat:                  { label: 'AI Chat',          icon: MessageSquare, color: '#14B8A6' },
}

function getServiceMeta(key: string) {
  return SERVICE_META[key] || { label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), icon: Zap, color: '#6B7280' }
}

// ─── Usage Activity Chart (pure SVG) ────────────────────────────────
interface HistoryRecord {
  service_type: string
  credits_spent: number
  created_at: string
}

interface DayData {
  date: string        // YYYY-MM-DD
  label: string       // "Feb 13"
  count: number
  credits: number
  byService: Record<string, number>
}

function UsageChart({ history }: { history: HistoryRecord[] }) {
  const { theme } = useTheme()
  const t = getJoyoTheme(theme)
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Build last 14 days
  const days: DayData[] = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    days.push({
      date: iso,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: 0,
      credits: 0,
      byService: {}
    })
  }

  // Fill from history
  for (const rec of history) {
    const recDate = rec.created_at.slice(0, 10)
    const day = days.find(d => d.date === recDate)
    if (!day) continue
    day.count++
    day.credits += rec.credits_spent
    day.byService[rec.service_type] = (day.byService[rec.service_type] || 0) + 1
  }

  const maxCount = Math.max(1, ...days.map(d => d.count))

  // Chart dimensions
  const W = 700, H = 200, PX = 40, PY = 30
  const plotW = W - PX * 2, plotH = H - PY * 2
  const stepX = plotW / (days.length - 1 || 1)

  // Build polyline points
  const points = days.map((d, i) => ({
    x: PX + i * stepX,
    y: PY + plotH - (d.count / maxCount) * plotH
  }))
  const line = points.map(p => `${p.x},${p.y}`).join(' ')

  // Gradient fill area
  const areaPath = `M${points[0].x},${PY + plotH} ${points.map(p => `L${p.x},${p.y}`).join(' ')} L${points[points.length - 1].x},${PY + plotH} Z`

  return (
    <div style={{
      background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
      padding: '22px 24px', animation: 'fadeUp 0.5s ease 0.35s both'
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>
        Weekly Performance
      </h3>
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto', minHeight: 180 }}>
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4A7CFF" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#4A7CFF" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => {
            const y = PY + plotH - frac * plotH
            return (
              <g key={frac}>
                <line x1={PX} y1={y} x2={PX + plotW} y2={y} stroke={t.border} strokeWidth={1} strokeDasharray={frac === 0 ? '' : '4,4'} />
                <text x={PX - 6} y={y + 4} textAnchor="end" fontSize={10} fill={t.textMuted}>
                  {Math.round(maxCount * frac)}
                </text>
              </g>
            )
          })}

          {/* Fill area */}
          <path d={areaPath} fill="url(#chartGrad)" />

          {/* Line */}
          <polyline points={line} fill="none" stroke="#4A7CFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points + hover zones */}
          {points.map((p, i) => (
            <g key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect x={p.x - stepX / 2} y={PY} width={stepX} height={plotH} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={hover === i ? 5.5 : 3.5}
                fill={hover === i ? '#4A7CFF' : t.card}
                stroke="#4A7CFF" strokeWidth={2}
                style={{ transition: 'r 0.15s ease' }}
              />
              {/* X label */}
              <text x={p.x} y={H + 16} textAnchor="middle" fontSize={9.5} fill={t.textMuted}>
                {i % 2 === 0 ? days[i].label : ''}
              </text>
            </g>
          ))}

          {/* Tooltip */}
          {hover !== null && days[hover].count > 0 && (() => {
            const d = days[hover]
            const p = points[hover]
            const lines = [
              `${d.label}: ${d.count} generation${d.count > 1 ? 's' : ''}`,
              `Credits: ${d.credits.toFixed(4)}`,
              ...Object.entries(d.byService).map(([svc, cnt]) => `${getServiceMeta(svc).label}: ${cnt}`)
            ]
            const tw = 180, th = 16 + lines.length * 15
            const tx = Math.min(Math.max(p.x - tw / 2, 4), W - tw - 4)
            // Flip tooltip below point if it would clip above chart
            const above = p.y - th - 14
            const ty = above < 0 ? p.y + 14 : above
            return (
              <g>
                <rect x={tx} y={ty} width={tw} height={th} rx={8} fill={t.card} stroke={t.border} strokeWidth={1} filter="drop-shadow(0 4px 8px rgba(0,0,0,0.15))" />
                {lines.map((ln, li) => (
                  <text key={li} x={tx + 10} y={ty + 14 + li * 15} fontSize={li === 0 ? 11 : 10}
                    fontWeight={li === 0 ? 700 : 500} fill={li === 0 ? t.text : t.textSecondary}>
                    {ln}
                  </text>
                ))}
              </g>
            )
          })()}
        </svg>
      </div>
    </div>
  )
}

// ─── AI Recommendations based on real data ──────────────────────────

function buildRecommendations(
  services: Record<string, { count: number; cost: number }>,
  bal: { total_purchased: number; used: number; remaining: number } | undefined,
  totalGens: number,
  t: any
): { text: string; color: string; icon: any }[] {
  const recs: { text: string; color: string; icon: any }[] = []

  const postCount = (services['social_posts']?.count || 0)
  const imgCount = (services['image_generation']?.count || 0)
  const adsCount = (services['google_ads']?.count || 0)
  const chatCount = (services['gemini_chat']?.count || 0) + (services['chat']?.count || 0)
  const videoCount = (services['video_dubbing']?.count || 0) + (services['video_dubbing_actual']?.count || 0)

  if (totalGens === 0) {
    recs.push({ text: 'Create your first social post to see AI-powered recommendations here.', color: t.accent, icon: Rocket })
    recs.push({ text: 'Set up your Brand Kit in Settings so AI can tailor content to your brand.', color: t.purple, icon: Palette })
    recs.push({ text: 'Try Google Ads generator to build a complete RSA campaign strategy.', color: t.success, icon: Target })
    return recs
  }

  if (postCount > 0 && adsCount === 0) {
    recs.push({ text: `You've created ${postCount} posts but haven't tried Google Ads yet — drive targeted traffic fast.`, color: t.success, icon: Target })
  }
  if (adsCount > 0 && postCount === 0) {
    recs.push({ text: `You're running ${adsCount} ad campaigns — complement them with organic social posts for better ROI.`, color: t.accent, icon: Send })
  }
  if (postCount > 5 && imgCount < postCount / 2) {
    recs.push({ text: 'Posts with images get 2.3x more engagement. Try generating images for more of your posts.', color: t.purple, icon: Image })
  }
  if (chatCount === 0) {
    recs.push({ text: 'Use the AI Advisor to get marketing insights and content ideas tailored to your brand.', color: t.accent, icon: MessageSquare })
  }
  if (bal) {
    const pct = bal.remaining / (bal.total_purchased || 1)
    if (pct < 0.15 && bal.remaining > 0) {
      recs.push({ text: `Only ${bal.remaining.toFixed(0)} credits left (${(pct * 100).toFixed(0)}%). Consider topping up soon.`, color: t.warning, icon: Coins })
    }
    if (pct > 0.8) {
      recs.push({ text: `${(pct * 100).toFixed(0)}% credits remaining — great time to experiment with new content types.`, color: t.success, icon: Zap })
    }
  }
  if (postCount >= 10) {
    recs.push({ text: `${postCount} posts this month! Try scheduling posts in advance for consistent publishing.`, color: t.accent, icon: TrendingUp })
  }
  if (videoCount > 0) {
    recs.push({ text: `${videoCount} videos translated — create short social clips from them for more reach.`, color: t.purple, icon: Film })
  }
  if (recs.length < 2) {
    recs.push({ text: 'Consistency is key — aim to create content at least 3 times per week.', color: t.accent, icon: Lightbulb })
  }

  return recs.slice(0, 4)
}

// ─── Main Dashboard ──────────────────────────────────────────────────

interface CreditsSummary {
  balance: { total_purchased: number; used: number; remaining: number }
  usage_30_days: { total_spent: number; by_service: Record<string, { count: number; cost: number }>; total_requests: number }
  usage_7_days: { total_spent: number; by_service: Record<string, { count: number; cost: number }>; total_requests: number }
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user, session } = useAuth()
  const { theme } = useTheme()
  const [summary, setSummary] = useState<CreditsSummary | null>(null)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  const t = getJoyoTheme(theme)

  useEffect(() => {
    if (!session) return
    const apiUrl = getApiUrl()
    const headers = { 'Authorization': `Bearer ${session.access_token}` }

    Promise.all([
      fetch(`${apiUrl}/api/credits/summary`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${apiUrl}/api/credits/history?limit=500`, { headers }).then(r => r.ok ? r.json() : null)
    ])
      .then(([summaryData, historyData]) => {
        if (summaryData) setSummary(summaryData)
        if (historyData?.history) setHistory(historyData.history)
      })
      .catch(e => console.error('Dashboard fetch error:', e))
      .finally(() => setLoading(false))
  }, [session])

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  const bal = summary?.balance
  const u30 = summary?.usage_30_days

  // Build service counts from history (more reliable — no date filter issues)
  const serviceCounts: Record<string, { count: number; cost: number }> = {}
  const now30 = Date.now() - 30 * 24 * 60 * 60 * 1000
  for (const rec of history) {
    if (new Date(rec.created_at).getTime() < now30) continue
    const svc = rec.service_type
    if (!serviceCounts[svc]) serviceCounts[svc] = { count: 0, cost: 0 }
    serviceCounts[svc].count++
    serviceCounts[svc].cost += rec.credits_spent
  }
  // Merge with summary data (pick whichever has more data)
  const mergedServices = { ...serviceCounts }
  for (const [svc, data] of Object.entries(u30?.by_service || {})) {
    if (!mergedServices[svc] || data.count > mergedServices[svc].count) {
      mergedServices[svc] = data
    }
  }
  // Total generations — use history count as fallback
  const historyTotal = Object.values(serviceCounts).reduce((s, d) => s + d.count, 0)
  const totalGens = Math.max(u30?.total_requests || 0, historyTotal)

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto' }}>
      {/* Welcome Banner */}
      <div style={{
        borderRadius: 20, padding: '32px 34px', marginBottom: 22,
        background: 'linear-gradient(135deg, #4A7CFF 0%, #6366F1 40%, #8B5CF6 70%, #A855F7 100%)',
        position: 'relative', overflow: 'hidden', animation: 'fadeUp 0.4s ease both'
      }}>
        <div style={{ position: 'absolute', top: -60, right: -40, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: '40%', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'white', marginBottom: 6 }}>
          Welcome back, {userName}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 20 }}>
          Your AI marketing platform is ready to create amazing content
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onNavigate('social')} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12,
            border: 'none', background: 'white', color: '#4A7CFF', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
          }}>
            <Rocket size={16} /> Quick Start
          </button>
          <button onClick={() => onNavigate('advisor')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '11px 20px', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            backdropFilter: 'blur(8px)'
          }}>
            <MessageSquare size={14} /> AI Advisor
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading metrics...</div>
      ) : (
        <>
          {/* Metric cards row */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
            <MetricCard
              icon={FileText}
              label="Posts Created"
              value={totalGens.toString()}
              sub="last 30 days"
              color={t.accent}
              delay={0.05}
            />
            <MetricCard
              icon={Megaphone}
              label="Active Campaigns"
              value={(mergedServices['google_ads']?.count || 0).toString()}
              sub="Google Ads"
              color={t.success}
              delay={0.1}
            />
            <MetricCard
              icon={TrendingUp}
              label="Total Reach"
              value={totalGens > 0 ? `~${(totalGens * 150).toLocaleString()}` : '0'}
              sub="estimated impressions"
              color={t.purple}
              delay={0.15}
            />
            <MetricCard
              icon={Coins}
              label="Credits"
              value={bal?.remaining?.toFixed(0) || '0'}
              sub={`${bal?.used?.toFixed(0) || '0'} used`}
              color={t.warning}
              delay={0.2}
            />
          </div>

          {/* Two-column: Chart + AI Recommendations */}
          <div style={{ display: 'flex', gap: 18, marginBottom: 22, flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 400 }}>
              {totalGens === 0 ? (
                <div style={{
                  background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
                  padding: '22px 24px', position: 'relative', overflow: 'hidden', animation: 'fadeUp 0.5s ease 0.35s both'
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>Weekly Performance</h3>
                  {/* Ghost Chart SVG */}
                  <div style={{ position: 'relative' }}>
                    <svg viewBox="0 0 700 200" style={{ width: '100%', height: 'auto', minHeight: 140, filter: 'blur(3px)', opacity: 0.3 }}>
                      <defs>
                        <linearGradient id="ghostGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4A7CFF" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#4A7CFF" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M40,170 L90,150 L140,160 L190,120 L240,130 L290,80 L340,90 L390,60 L440,70 L490,40 L540,55 L590,30 L640,45 L660,35" fill="none" stroke="#4A7CFF" strokeWidth="3" />
                      <path d="M40,200 L40,170 L90,150 L140,160 L190,120 L240,130 L290,80 L340,90 L390,60 L440,70 L490,40 L540,55 L590,30 L640,45 L660,35 L660,200 Z" fill="url(#ghostGrad)" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <BarChart3 size={28} style={{ color: t.accent, opacity: 0.8 }} />
                      <p style={{ fontSize: 13, fontWeight: 600, color: t.text, textAlign: 'center' }}>Publish your first post to see engagement data here</p>
                      <button onClick={() => onNavigate('social')} style={{
                        padding: '8px 18px', borderRadius: 10, border: 'none',
                        background: t.gradient1, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                      }}>
                        <Send size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Create First Post
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <UsageChart history={history} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{
                background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
                padding: '22px 24px', height: '100%', animation: 'fadeUp 0.5s ease 0.35s both'
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lightbulb size={16} color={t.warning} /> AI Recommendations
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {buildRecommendations(mergedServices, bal, totalGens, t).map((rec, i) => {
                    const RecIcon = rec.icon
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '12px 14px', borderRadius: 12,
                        background: `${rec.color}10`, borderLeft: `3px solid ${rec.color}`,
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: `${rec.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <RecIcon size={14} color={rec.color} />
                        </div>
                        <span style={{ fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5 }}>{rec.text}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Quick-action feature cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', animation: 'fadeUp 0.5s ease 0.4s both' }}>
        {[
          { icon: Send, title: 'Post Generator', desc: 'AI captions + images for every platform', gradient: t.gradient1, to: 'social' },
          { icon: Target, title: 'Google Ads', desc: 'Full campaign strategy & RSA assets', gradient: t.gradient2, to: 'ads' },
          { icon: Image, title: 'Media Studio', desc: 'Templates, resize, background removal', gradient: t.gradient4, to: 'media' },
          { icon: MessageSquare, title: 'AI Advisor', desc: 'Insights, analytics & recommendations', gradient: t.gradient3, to: 'chat' },
        ].map((f, i) => (
          <div key={i} onClick={() => onNavigate(f.to)} style={{
            background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
            transition: 'all 0.25s ease', flex: 1, minWidth: 190, padding: 20, cursor: 'pointer'
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: f.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
            }}>
              <f.icon size={20} color="white" />
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: t.textSecondary }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
