import { useState, useEffect } from 'react'
import { Send, Target, ArrowUp, ArrowDown, Film, Coins, Zap, BarChart3, TrendingUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getJoyoTheme } from '../styles/joyo-theme'

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

interface CreditsSummary {
  balance: { total_purchased: number; used: number; remaining: number }
  usage_30_days: { total_spent: number; by_service: Record<string, { count: number; cost: number }>; total_requests: number }
  usage_7_days: { total_spent: number; by_service: Record<string, { count: number; cost: number }>; total_requests: number }
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user, session } = useAuth()
  const { theme } = useTheme()
  const [summary, setSummary] = useState<CreditsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const t = getJoyoTheme(theme)

  useEffect(() => {
    if (!session) return
    const apiUrl = import.meta.env.VITE_API_URL || 'https://assaf-automation-production.up.railway.app'

    fetch(`${apiUrl}/api/credits/summary`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setSummary(data))
      .catch(e => console.error('Dashboard fetch error:', e))
      .finally(() => setLoading(false))
  }, [session])

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  const bal = summary?.balance
  const u30 = summary?.usage_30_days
  const u7 = summary?.usage_7_days

  // calc change direction: if 7d avg > 30d avg => up
  const avg30 = (u30?.total_requests || 0) / 30
  const avg7 = (u7?.total_requests || 0) / 7
  const trend: 'up' | 'down' = avg7 >= avg30 ? 'up' : 'down'
  const trendPct = avg30 > 0 ? Math.round(((avg7 - avg30) / avg30) * 100) : 0

  // service breakdown for 30d
  const services = u30?.by_service || {}
  const serviceList = Object.entries(services)
    .sort(([, a], [, b]) => b.count - a.count)

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto' }}>
      {/* Welcome Banner */}
      <div style={{
        borderRadius: 18, padding: '26px 30px', marginBottom: 22,
        background: 'linear-gradient(135deg, #1B2A4A 0%, #2A3F6E 50%, #3B4F8A 100%)',
        position: 'relative', overflow: 'hidden', animation: 'fadeUp 0.4s ease both'
      }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 200, height: 200, borderRadius: '50%', background: 'rgba(74,124,255,0.12)' }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'white', marginBottom: 5 }}>
          Welcome back, {userName}
        </h1>
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', marginBottom: 18 }}>
          Your AI marketing platform is ready to create amazing content
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onNavigate('social')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10,
            border: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 12.5, fontWeight: 650, cursor: 'pointer'
          }}>
            <Send size={14} /> Create Posts
          </button>
          <button onClick={() => onNavigate('ads')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
          }}>
            <Target size={14} /> Google Ads
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading metrics...</div>
      ) : (
        <>
          {/* Metric Cards */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
            <MetricCard
              icon={Coins}
              label="Credits Remaining"
              value={bal?.remaining?.toFixed(2) || '0'}
              sub={`of ${bal?.total_purchased?.toFixed(2) || '0'} purchased`}
              color={t.accent}
              delay={0.05}
            />
            <MetricCard
              icon={Zap}
              label="Credits Used"
              value={bal?.used?.toFixed(2) || '0'}
              sub={`${u30?.total_spent?.toFixed(4) || '0'} last 30d`}
              color={t.purple}
              delay={0.1}
            />
            <MetricCard
              icon={BarChart3}
              label="Requests (30d)"
              value={(u30?.total_requests || 0).toString()}
              change={trendPct !== 0 ? `${Math.abs(trendPct)}% vs prev week` : undefined}
              changeDir={trend}
              color={t.success}
              delay={0.15}
            />
            <MetricCard
              icon={TrendingUp}
              label="Requests (7d)"
              value={(u7?.total_requests || 0).toString()}
              color={t.warning}
              delay={0.2}
            />
          </div>

          {/* Service Breakdown */}
          {serviceList.length > 0 && (
            <div style={{
              background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
              padding: '22px 24px', marginBottom: 22, animation: 'fadeUp 0.5s ease 0.3s both'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>
                Usage by Service (30 days)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {serviceList.map(([service, data]) => {
                  const maxCount = serviceList[0]?.[1]?.count || 1
                  const pct = (data.count / maxCount) * 100
                  return (
                    <div key={service}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>
                          {service.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        <span style={{ fontSize: 12, color: t.textSecondary }}>
                          {data.count} req · {data.cost.toFixed(4)} credits
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: t.borderLight }}>
                        <div style={{
                          height: '100%', borderRadius: 3, width: `${pct}%`,
                          background: t.gradient1, transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', animation: 'fadeUp 0.5s ease 0.4s both' }}>
        {[
          { icon: Send, title: 'Social Posts', desc: 'AI captions + images', gradient: t.gradient1, to: 'social' },
          { icon: Target, title: 'Google Ads', desc: 'Full campaign generation', gradient: t.gradient2, to: 'ads' },
          { icon: Film, title: 'Video Tools', desc: 'Translation & dubbing', gradient: t.gradient3, to: 'video' }
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
