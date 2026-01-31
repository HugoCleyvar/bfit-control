import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'white', fontFamily: 'sans-serif' }}>
          <h1>Algo salió mal (Aplicación Detenida)</h1>
          <p>Por favor, comparte este error:</p>
          <pre style={{ color: '#ff4d4d', background: 'rgba(0,0,0,0.5)', padding: 15, borderRadius: 8, overflow: 'auto' }}>
            {this.state.error?.toString()}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
