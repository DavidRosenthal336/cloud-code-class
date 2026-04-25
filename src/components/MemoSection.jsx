import { useState } from 'react';
import { generateMemo } from '../lib/memoClient.js';

export default function MemoSection({ inputs, metrics, projections, memo, setMemo }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await generateMemo({ inputs, metrics, projections });
      setMemo(text);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rvc-card p-5">
      <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
        <h2 className="font-serif text-lg text-navy">AI Investment Memo</h2>
        <button onClick={onGenerate} disabled={loading} className="rvc-btn-primary">
          {loading ? 'Generating…' : memo ? 'Regenerate' : 'Generate Memo'}
        </button>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-md mb-3">
          {error}
        </div>
      )}
      {!memo && !error && !loading && (
        <p className="text-sm text-slate-500">
          Click <strong>Generate Memo</strong> to produce a plain-English investment narrative
          using Claude. The memo will include the investment thesis, strengths, risks, and a
          recommendation.
        </p>
      )}
      {loading && (
        <p className="text-sm text-slate-500 italic">
          Drafting the memo (typically 5–15 seconds)…
        </p>
      )}
      {memo && (
        <div className="prose prose-slate prose-sm max-w-none mt-2">
          <RenderedMemo text={memo} />
        </div>
      )}
    </div>
  );
}

// Render very lightweight markdown: **bold** headers, "- " bullets, and paragraphs.
function RenderedMemo({ text }) {
  const blocks = [];
  const lines = text.split('\n');
  let buf = [];
  let mode = 'p';

  const flush = () => {
    if (!buf.length) return;
    if (mode === 'ul') {
      blocks.push(
        <ul key={blocks.length} className="list-disc pl-5 space-y-1 my-2 text-sm">
          {buf.map((b, i) => (
            <li key={i}>{renderInline(b)}</li>
          ))}
        </ul>
      );
    } else {
      blocks.push(
        <p key={blocks.length} className="text-sm my-2">
          {renderInline(buf.join(' '))}
        </p>
      );
    }
    buf = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      mode = 'p';
      continue;
    }
    if (/^\*\*.+\*\*$/.test(line)) {
      flush();
      blocks.push(
        <h3
          key={blocks.length}
          className="font-serif text-base text-navy mt-4 mb-1 font-semibold"
        >
          {line.replace(/\*\*/g, '')}
        </h3>
      );
      mode = 'p';
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      if (mode !== 'ul') flush();
      mode = 'ul';
      buf.push(line.replace(/^[-•]\s+/, ''));
      continue;
    }
    if (mode === 'ul') flush();
    mode = 'p';
    buf.push(line);
  }
  flush();
  return <>{blocks}</>;
}

function renderInline(text) {
  // bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
