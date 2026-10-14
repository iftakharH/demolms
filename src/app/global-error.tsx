'use client';

/** Last-resort boundary: the root layout itself failed, so this renders its own html/body. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Segoe UI, Arial, sans-serif',
          background: '#f7f7fb',
          color: '#1b1a24',
        }}
      >
        <div style={{ maxWidth: 460, padding: 32, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>The app failed to start this page</h1>
          <p style={{ color: '#5c5a6b', fontSize: 14, lineHeight: 1.6 }}>
            This is the global error boundary. In the demo this usually means the database file is
            missing - run <code>npm run seed</code> and reload.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#7c7a8c' }}>ref: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 18,
              background: '#6c4cf1',
              color: '#fff',
              border: 0,
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
