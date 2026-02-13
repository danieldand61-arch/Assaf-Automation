import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppWithAuth } from './AppWithAuth.tsx'
import { AppProvider } from './contexts/AppContext'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppProvider>
        <AppWithAuth />
      </AppProvider>
    </ThemeProvider>
  </React.StrictMode>,
)

