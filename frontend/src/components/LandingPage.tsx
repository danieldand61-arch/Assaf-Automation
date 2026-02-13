import { Sparkles, Zap, Users, Image as ImageIcon, ArrowRight, Video, Target, Calendar, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { JoyoTheme } from '../styles/joyo-theme'

export function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { accounts, loading: accountsLoading } = useAccount()

  const handleGetStarted = () => {
    if (!user) {
      // Not logged in -> go to signup (FIRST!)
      navigate('/signup')
    } else if (accounts.length === 0 && !accountsLoading) {
      // Logged in but no accounts -> go to onboarding
      navigate('/onboarding')
    } else {
      // Logged in with accounts -> go to app
      navigate('/app')
    }
  }
  
  // Button text based on state
  const getButtonText = () => {
    if (!user) return 'Get Started Free'
    if (accountsLoading) return 'Loading...'
    if (accounts.length === 0) return 'Complete Setup'
    return 'Go to App'
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: JoyoTheme.surface,
      fontFamily: "'Plus Jakarta Sans','Inter',-apple-system,sans-serif"
    }}>
      {/* Header */}
      <div style={{ 
        borderBottom: `1px solid ${JoyoTheme.border}`,
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ 
          maxWidth: 1200, 
          margin: '0 auto', 
          padding: '18px 24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ 
              width: 44, 
              height: 44, 
              background: JoyoTheme.gradient1, 
              borderRadius: 12, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(74,124,255,0.35)'
            }}>
              <Sparkles size={22} color="white" />
            </div>
            <div>
              <h1 style={{ 
                fontSize: 19, 
                fontWeight: 800, 
                color: JoyoTheme.text,
                letterSpacing: -0.5 
              }}>
                JOYO
              </h1>
              <p style={{ 
                fontSize: 10, 
                color: JoyoTheme.textSecondary,
                fontWeight: 600,
                letterSpacing: 1.5
              }}>
                AI MARKETING
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user ? (
              <>
                {accounts.length === 0 && !accountsLoading && (
                  <button
                    onClick={() => navigate('/onboarding')}
                    style={{
                      padding: '9px 18px',
                      color: JoyoTheme.accent,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    Complete Setup
                  </button>
                )}
                <button
                  onClick={() => navigate('/app')}
                  style={{
                    padding: '10px 24px',
                    background: JoyoTheme.gradient1,
                    color: 'white',
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 650,
                    boxShadow: '0 4px 16px rgba(74,124,255,0.3)'
                  }}
                >
                  {accounts.length === 0 ? 'Skip to App' : 'Go to App'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  style={{
                    padding: '9px 18px',
                    color: JoyoTheme.text,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  Login
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  style={{
                    padding: '10px 24px',
                    background: JoyoTheme.gradient1,
                    color: 'white',
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 650,
                    boxShadow: '0 4px 16px rgba(74,124,255,0.3)'
                  }}
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: 80, 
            height: 80, 
            background: JoyoTheme.gradient1, 
            borderRadius: 24, 
            marginBottom: 32,
            boxShadow: '0 12px 32px rgba(74,124,255,0.4)'
          }}>
            <Sparkles size={40} color="white" />
          </div>
          
          <h1 style={{ 
            fontSize: 52, 
            fontWeight: 800, 
            color: JoyoTheme.text, 
            marginBottom: 16,
            letterSpacing: -1.5,
            lineHeight: 1.1
          }}>
            Create Stunning Social Posts
          </h1>
          <p style={{ 
            fontSize: 28, 
            fontWeight: 700,
            background: JoyoTheme.gradient1,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 24
          }}>
            in Seconds, Not Hours
          </p>
          <p style={{ 
            fontSize: 18, 
            color: JoyoTheme.textSecondary, 
            maxWidth: 700, 
            margin: '0 auto 48px',
            lineHeight: 1.6
          }}>
            Transform any website into engaging social media content with AI. Generate posts, images, and captions tailored for Instagram, Facebook, LinkedIn, and more.
          </p>

          <button
            onClick={handleGetStarted}
            disabled={accountsLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 32px',
              background: JoyoTheme.gradient1,
              color: 'white',
              fontSize: 17,
              fontWeight: 700,
              borderRadius: 14,
              border: 'none',
              cursor: accountsLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 24px rgba(74,124,255,0.4)',
              opacity: accountsLoading ? 0.6 : 1,
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => !accountsLoading && (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => !accountsLoading && (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Sparkles size={22} />
            {getButtonText()}
            <ArrowRight size={20} />
          </button>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 32, 
            fontSize: 13, 
            color: JoyoTheme.textSecondary, 
            marginTop: 32,
            fontWeight: 600
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                width: 8, 
                height: 8, 
                background: JoyoTheme.success, 
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}></div>
              No credit card required
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                width: 8, 
                height: 8, 
                background: JoyoTheme.success, 
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}></div>
              Start generating in 30 seconds
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: 24, 
          marginTop: 64 
        }}>
          {/* AI-Powered Generation */}
          <div style={{
            background: JoyoTheme.card,
            borderRadius: 18,
            padding: 32,
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            border: `1px solid ${JoyoTheme.border}`,
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'
          }}>
            <div style={{
              width: 56,
              height: 56,
              background: JoyoTheme.gradient1,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              boxShadow: '0 4px 16px rgba(74,124,255,0.3)'
            }}>
              <Zap size={28} color="white" />
            </div>
            <h3 style={{
              fontSize: 20,
              fontWeight: 800,
              color: JoyoTheme.text,
              marginBottom: 12
            }}>
              AI-Powered Generation
            </h3>
            <p style={{
              fontSize: 14,
              color: JoyoTheme.textSecondary,
              lineHeight: 1.6
            }}>
              Advanced AI analyzes your website and generates perfectly crafted posts optimized for engagement. Multiple variations for A/B testing.
            </p>
          </div>

          {/* Multi-Platform Support */}
          <div style={{
            background: JoyoTheme.card,
            borderRadius: 18,
            padding: 32,
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            border: `1px solid ${JoyoTheme.border}`,
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'
          }}>
            <div style={{
              width: 56,
              height: 56,
              background: JoyoTheme.gradient4,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              boxShadow: '0 4px 16px rgba(236,72,153,0.3)'
            }}>
              <Users size={28} color="white" />
            </div>
            <h3 style={{
              fontSize: 20,
              fontWeight: 800,
              color: JoyoTheme.text,
              marginBottom: 12
            }}>
              Multi-Platform Support
            </h3>
            <p style={{
              fontSize: 14,
              color: JoyoTheme.textSecondary,
              lineHeight: 1.6
            }}>
              Create content optimized for Instagram, Facebook, LinkedIn, Twitter, and TikTok. Each platform gets tailored copy and formatting.
            </p>
          </div>

          {/* Custom Image Generation */}
          <div style={{
            background: JoyoTheme.card,
            borderRadius: 18,
            padding: 32,
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            border: `1px solid ${JoyoTheme.border}`,
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'
          }}>
            <div style={{
              width: 56,
              height: 56,
              background: JoyoTheme.gradient3,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              boxShadow: '0 4px 16px rgba(249,115,22,0.3)'
            }}>
              <ImageIcon size={28} color="white" />
            </div>
            <h3 style={{
              fontSize: 20,
              fontWeight: 800,
              color: JoyoTheme.text,
              marginBottom: 12
            }}>
              Custom Image Generation
            </h3>
            <p style={{
              fontSize: 14,
              color: JoyoTheme.textSecondary,
              lineHeight: 1.6
            }}>
              Generate eye-catching images that match your brand. AI creates unique visuals or enhances your existing photos.
            </p>
          </div>
        </div>

        {/* Additional Features */}
        <div style={{
          marginTop: 80,
          background: JoyoTheme.card,
          borderRadius: 20,
          padding: 48,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          border: `1px solid ${JoyoTheme.border}`
        }}>
          <h2 style={{
            fontSize: 32,
            fontWeight: 800,
            color: JoyoTheme.text,
            marginBottom: 40,
            textAlign: 'center',
            letterSpacing: -0.8
          }}>
            Everything You Need to Scale Your Social Media
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 32
          }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  background: JoyoTheme.gradient2,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                }}>
                  <Target size={24} color="white" />
                </div>
              </div>
              <div>
                <h4 style={{
                  fontWeight: 700,
                  color: JoyoTheme.text,
                  marginBottom: 8,
                  fontSize: 16
                }}>
                  Google Ads Generation
                </h4>
                <p style={{
                  fontSize: 14,
                  color: JoyoTheme.textSecondary,
                  lineHeight: 1.5
                }}>
                  Create high-performing Google Ads campaigns with AI-optimized headlines and descriptions.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  background: JoyoTheme.gradient1,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(74,124,255,0.3)'
                }}>
                  <Video size={24} color="white" />
                </div>
              </div>
              <div>
                <h4 style={{
                  fontWeight: 700,
                  color: JoyoTheme.text,
                  marginBottom: 8,
                  fontSize: 16
                }}>
                  Video Dubbing
                </h4>
                <p style={{
                  fontSize: 14,
                  color: JoyoTheme.textSecondary,
                  lineHeight: 1.5
                }}>
                  Translate and dub your videos into multiple languages with AI-powered voice cloning.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  background: JoyoTheme.gradient4,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(139,92,246,0.3)'
                }}>
                  <MessageSquare size={24} color="white" />
                </div>
              </div>
              <div>
                <h4 style={{
                  fontWeight: 700,
                  color: JoyoTheme.text,
                  marginBottom: 8,
                  fontSize: 16
                }}>
                  AI Chat Assistant
                </h4>
                <p style={{
                  fontSize: 14,
                  color: JoyoTheme.textSecondary,
                  lineHeight: 1.5
                }}>
                  Chat with AI to generate content, get marketing advice, and optimize your campaigns.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  background: JoyoTheme.gradient3,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(249,115,22,0.3)'
                }}>
                  <Calendar size={24} color="white" />
                </div>
              </div>
              <div>
                <h4 style={{
                  fontWeight: 700,
                  color: JoyoTheme.text,
                  marginBottom: 8,
                  fontSize: 16
                }}>
                  Smart Scheduling
                </h4>
                <p style={{
                  fontSize: 14,
                  color: JoyoTheme.textSecondary,
                  lineHeight: 1.5
                }}>
                  Schedule posts across all platforms with optimal timing suggestions based on your audience.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div style={{ marginTop: 80, textAlign: 'center' }}>
          <h2 style={{
            fontSize: 36,
            fontWeight: 800,
            color: JoyoTheme.text,
            marginBottom: 16,
            letterSpacing: -1
          }}>
            Ready to Transform Your Social Media?
          </h2>
          <p style={{
            fontSize: 18,
            color: JoyoTheme.textSecondary,
            marginBottom: 32
          }}>
            Get started with JOYO today. No credit card required.
          </p>
          <button
            onClick={handleGetStarted}
            disabled={accountsLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 32px',
              background: JoyoTheme.gradient1,
              color: 'white',
              fontSize: 17,
              fontWeight: 700,
              borderRadius: 14,
              border: 'none',
              cursor: accountsLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 24px rgba(74,124,255,0.4)',
              opacity: accountsLoading ? 0.6 : 1,
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => !accountsLoading && (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => !accountsLoading && (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Sparkles size={22} />
            {getButtonText()}
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
