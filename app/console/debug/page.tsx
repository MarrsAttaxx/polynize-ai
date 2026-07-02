import { readClientFile } from '@/lib/github-client';

export const dynamic = 'force-dynamic';

export default async function ConsoleDebugPage() {
  let content: string | null = null;
  let error: string | null = null;

  try {
    content = await readClientFile('everstock', '.polynize/client-config.yaml');
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, sans-serif', fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
        Console debug
      </h1>
      <p style={{ fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.02em', color: 'var(--text-3)', margin: '0 0 28px' }}>
        Reading <code>.polynize/client-config.yaml</code> from <code>polynize-agentic/everstock</code>
      </p>
      {error !== null && (
        <div
          role="alert"
          style={{
            background: 'rgba(255, 122, 107, 0.08)',
            border: '1px solid rgba(255, 122, 107, 0.3)',
            padding: '16px 18px',
            borderRadius: 10,
            color: 'var(--coral)',
            fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
            fontSize: 13,
          }}
        >
          <strong>GitHub App call failed</strong>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '8px 0 0' }}>{error}</pre>
        </div>
      )}
      {content !== null && (
        <pre
          style={{
            background: 'var(--tac-inset)',
            boxShadow: 'var(--tac-shadow-inset)',
            padding: '20px 22px',
            borderRadius: 12,
            fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
            fontSize: 13,
            lineHeight: 1.65,
            color: 'var(--text)',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </pre>
      )}
    </div>
  );
}
