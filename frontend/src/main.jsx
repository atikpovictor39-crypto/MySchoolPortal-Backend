import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { Sentry } from './sentry';
import './index.css';

function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F8FF] px-4">
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-900">Something went wrong.</p>
        <p className="text-sm text-slate-500 mt-1">Please refresh the page — we've been notified.</p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);

// Registers the push/notification service worker. Safe to skip silently in
// browsers without support (older Safari, etc.) — push is a progressive
// enhancement here, not something the app depends on to function.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
