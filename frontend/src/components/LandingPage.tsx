import { Sparkles, Zap, Globe, Calendar, Users, Image, ArrowRight, LogIn } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

interface LandingPageProps {
  onGetStarted: () => void
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleCTA = () => {
    if (user) {
      onGetStarted()
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered Social Media Automation
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Create Stunning Social Posts
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              in Seconds, Not Hours
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto">
            Transform any website into engaging social media content with AI. 
            Generate posts, images, and captions tailored for Instagram, Facebook, LinkedIn, and more.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleCTA}
              className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold text-lg transition shadow-xl hover:shadow-2xl flex items-center gap-2"
            >
              {user ? (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Content
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                </>
              )}
            </button>
            
            {!user && (
              <button
                onClick={() => navigate('/signup')}
                className="px-8 py-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold text-lg transition"
              >
                Sign Up
              </button>
            )}
          </div>

          {/* Social Proof */}
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            ✨ No credit card required • 🚀 Start generating in 30 seconds
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Feature 1 */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              AI-Powered Generation
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Our AI analyzes websites and creates engaging posts with captions, hashtags, and stunning images.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Multi-Platform Support
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Create content optimized for Facebook, Instagram, LinkedIn, Twitter/X, and TikTok.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-4">
              <Image className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Custom Image Generation
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              AI creates unique images in any aspect ratio (square, landscape, story) matching your brand.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Smart Scheduling
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Schedule posts for optimal engagement times. Post immediately or plan your entire content calendar.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Multi-Account Management
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Manage multiple business accounts with team collaboration and role-based permissions.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Multi-Language Support
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Generate content in English, Hebrew, Spanish, and Portuguese. Expand your global reach effortlessly.
            </p>
          </div>

        </div>
      </div>

      {/* Bottom CTA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Social Media?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses automating their social media content with AI.
          </p>
          <button
            onClick={handleCTA}
            className="px-10 py-4 bg-white hover:bg-gray-100 text-blue-600 rounded-xl font-bold text-lg transition shadow-xl hover:shadow-2xl inline-flex items-center gap-2"
          >
            {user ? (
              <>
                <Sparkles className="w-5 h-5" />
                Start Generating Now
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Get Started Free
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  )
}
