export async function generateMemo({ inputs, metrics, projections }) {
  const res = await fetch('/api/generate-memo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs, metrics, projections }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data.memo;
}
