'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <section
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            backgroundColor: '#FFFFFF',
            color: '#201D12',
          }}
        >
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 12px' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#5C5744', margin: '0 0 20px', lineHeight: 1.5 }}>
              An unexpected error occurred. Please try again.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                background: '#E9A215',
                color: '#201D12',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 28px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            {error.digest ? (
              <p style={{ fontSize: '12px', color: '#5C5744', marginTop: '20px' }}>
                Error code: {error.digest}
              </p>
            ) : null}
          </div>
        </section>
      </body>
    </html>
  );
}
