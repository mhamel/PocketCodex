import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import MobileApp from './MobileApp'
import './index.css'

const isMobile = window.location.pathname.toLowerCase().startsWith('/mobile')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isMobile ? <MobileApp /> : <App />}
  </React.StrictMode>
)
