import { fmtCurrency, fmtPercent, fmtMultiple, fmtRatio } from '../lib/format.js';

export default function KeyMetrics({ metrics }) {
  const cards = [
    { label: 'Going-in Cap Rate', value: fmtPercent(metrics.capRate) },
    { label: 'Cash-on-Cash Y1', value: fmtPercent(metrics.cashOnCash) },
    { label: 'DSCR', value: fmtRatio(metrics.dscr) },
    { label: 'Levered IRR', value: fmtPercent(metrics.irr) },
    { label: 'Equity Multiple', value: fmtMultiple(metrics.equityMultiple) },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rvc-card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {c.label}
            </div>
            <div className="font-serif text-2xl text-navy mt-1 tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <SubMetric label="Year 1 NOI" value={fmtCurrency(metrics.noi)} />
        <SubMetric label="Annual Debt Service" value={fmtCurrency(metrics.annualDebtService)} />
        <SubMetric label="Initial Equity" value={fmtCurrency(metrics.initialEquity)} />
        <SubMetric label="Projected Sale Proceeds" value={fmtCurrency(metrics.saleProceeds)} />
      </div>
    </div>
  );
}

function SubMetric({ label, value }) {
  return (
    <div className="rvc-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm text-slate-ink tabular-nums">{value}</div>
    </div>
  );
}
