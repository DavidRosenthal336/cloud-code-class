import { useState } from 'react';
import { exportMemoPDF } from '../lib/pdf.js';

export default function ExportButton({ inputs, metrics, projections, sensitivity, axes, memo }) {
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    try {
      await exportMemoPDF({ inputs, metrics, projections, sensitivity, axes, memo });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={onExport} disabled={busy} className="rvc-btn-secondary">
      {busy ? 'Building PDF…' : 'Download PDF Memo'}
    </button>
  );
}
