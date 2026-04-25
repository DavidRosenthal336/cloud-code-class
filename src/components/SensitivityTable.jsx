import { fmtPercent } from '../lib/format.js';

export default function SensitivityTable({ sensitivity, axes }) {
  return (
    <div className="rvc-card p-5">
      <h2 className="font-serif text-lg text-navy mb-3 border-b border-slate-200 pb-2">
        Sensitivity — IRR
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Levered IRR across exit cap rate (rows) and rent growth (columns). Center cell is the
        base case.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-slate-200">
          <thead>
            <tr className="bg-slate-50">
              <th className="py-2 px-3 text-[11px] uppercase tracking-wide text-slate-600 text-left">
                Exit Cap \ Rent Growth
              </th>
              {axes.rentGrowth.map((rg, i) => (
                <th
                  key={i}
                  className="py-2 px-3 text-[11px] uppercase tracking-wide text-slate-600 text-right"
                >
                  {fmtPercent(rg)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sensitivity.map((row, ri) => (
              <tr key={ri} className="border-t border-slate-200">
                <td className="py-2 px-3 text-[11px] uppercase tracking-wide text-slate-600">
                  {fmtPercent(axes.exitCap[ri])}
                </td>
                {row.map((irr, ci) => {
                  const isCenter = ri === 1 && ci === 1;
                  return (
                    <td
                      key={ci}
                      className={`py-2 px-3 text-right tabular-nums ${
                        isCenter ? 'bg-navy text-white font-semibold' : ''
                      }`}
                    >
                      {fmtPercent(irr)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
