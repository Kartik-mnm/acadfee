import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App';
import './mobile.css';

const dsn = process.env.REACT_APP_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
  console.log("✅ Sentry initialized on client");
} else {
  console.log("ℹ️ REACT_APP_SENTRY_DSN not configured. Sentry tracking is disabled.");
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
