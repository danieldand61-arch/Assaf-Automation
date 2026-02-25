import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { SavedPostsLibrary } from '../components/SavedPostsLibrary'

export function Library() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="max-w-7xl mx-auto">
      <SavedPostsLibrary />
    </div>
  )
}
