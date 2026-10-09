import * as Sentry from '@sentry/react'

// Without VITE_SENTRY_DSN the SDK stays disabled
export function initSentry() {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD && !!import.meta.env.VITE_SENTRY_DSN,
  })
}
