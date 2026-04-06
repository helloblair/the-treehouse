// Sentry disabled — this is a children's educational platform (COPPA compliance).
// Error reports could contain PII (user IDs, session data, device info).
// No telemetry is sent to third-party error tracking services.

const Sentry = {
  captureException: (err: unknown) => {
    console.error('[Treehouse error]', err)
  },
  init: () => {},
  withScope: (cb: (scope: unknown) => void) => cb({}),
  setTag: () => {},
  setUser: () => {},
}

export default Sentry
