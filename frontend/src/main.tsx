import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppWithAuth } from './AppWithAuth.tsx'
import { AppProvider } from './contexts/AppContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <AppWithAuth />
    </AppProvider>
  </React.StrictMode>,
)

