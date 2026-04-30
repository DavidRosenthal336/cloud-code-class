import { fmtPercent } from '../lib/format.js';

export default function SensitivityTable({ sensitivity, axes }) {
  return (
    <div className="rvc-card p-5">
      <h2 className="font-serif text-lg text-navy mb-3 border-b border-slate-200 pb-2">
        Sensitivity — IRR vs. Exit Cap Rate
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Levered IRR at exit cap rates ±1.00% from the base assumption, in 25 bps increments.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-slate-200">
          <thead>
            <tr className="bg-slate-50">
              <th className="py-2 px-3 text-[11px] uppercase tracking-wide text-slate-600 text-left">
                Exit Cap
              </th>
              {axes.exitCap.map((ec, i) => {
                const isCenter = i === 4;
                return (
                  <th
                    key={i}
                    className={`py-2 px-3 text-[11px] uppercase tracking-wide text-right ${
                      isCenter ? 'bg-navy text-white' : 'text-slate-600'
                    }`}
                  >
                    {fmtPercent(ec)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-200">
              <td className="py-2 px-3 text-[11px] uppercase tracking-wide text-slate-600 font-semibold">
                Levered IRR
              </td>
              {sensitivity.map((irr, i) => {
                const isCenter = i === 4;
                return (
                  <td
                    key={i}
                    className={`py-2 px-3 text-right tabular-nums ${
                      isCenter ? 'bg-navy text-white font-semibold' : ''
                    }`}
                  >
                    {fmtPercent(irr)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
