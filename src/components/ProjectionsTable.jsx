import { fmtCurrency } from '../lib/format.js';

export default function ProjectionsTable({ projections, holdPeriod }) {
  return (
    <div className="rvc-card p-5">
      <h2 className="font-serif text-lg text-navy mb-3 border-b border-slate-200 pb-2">
        10-Year Projections
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <Th>Year</Th>
              <Th right>EGI</Th>
              <Th right>OpEx</Th>
              <Th right>NOI</Th>
              <Th right>Debt Service</Th>
              <Th right>Cash Flow</Th>
              <Th right>Cumulative CF</Th>
            </tr>
          </thead>
          <tbody>
            {projections.map((p) => (
              <tr
                key={p.year}
                className={`border-b border-slate-100 ${
                  p.year === holdPeriod ? 'bg-gold-soft/20 font-medium' : ''
                }`}
              >
                <Td>
                  {p.year}
                  {p.year === holdPeriod && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-gold">
                      Exit
                    </span>
                  )}
                </Td>
                <Td right>{fmtCurrency(p.egi)}</Td>
                <Td right>{fmtCurrency(p.opex)}</Td>
                <Td right>{fmtCurrency(p.noi)}</Td>
                <Td right>{fmtCurrency(p.debtService)}</Td>
                <Td right className={p.cashFlow < 0 ? 'text-red-700' : ''}>
                  {fmtCurrency(p.cashFlow)}
                </Td>
                <Td right>{fmtCurrency(p.cumulativeCashFlow)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, right }) {
  return (
    <th
      className={`py-2 px-2 text-[11px] uppercase tracking-wide text-slate-600 font-semibold ${
        right ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, right, className = '' }) {
  return (
    <td className={`py-2 px-2 tabular-nums ${right ? 'text-right' : ''} ${className}`}>
      {children}
    </td>
  );
}
