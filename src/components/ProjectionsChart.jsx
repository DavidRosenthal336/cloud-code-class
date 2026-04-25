import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function ProjectionsChart({ projections, holdPeriod }) {
  const data = projections.map((p) => ({
    year: `Y${p.year}`,
    NOI: Math.round(p.noi),
    'Cash Flow': Math.round(p.cashFlow),
  }));

  return (
    <div id="rvc-projections-chart" className="rvc-card p-5">
      <h2 className="font-serif text-lg text-navy mb-3 border-b border-slate-200 pb-2">
        NOI & Cash Flow Projection
      </h2>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" stroke="#475569" fontSize={12} />
            <YAxis
              stroke="#475569"
              fontSize={12}
              tickFormatter={(v) => '$' + (v / 1000).toFixed(0) + 'k'}
            />
            <Tooltip
              formatter={(v) => '$' + v.toLocaleString('en-US')}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              x={`Y${holdPeriod}`}
              stroke="#B08D57"
              strokeDasharray="4 2"
              label={{ value: 'Exit', position: 'top', fill: '#B08D57', fontSize: 11 }}
            />
            <Line type="monotone" dataKey="NOI" stroke="#0A1F44" strokeWidth={2} dot={false} />
            <Line
              type="monotone"
              dataKey="Cash Flow"
              stroke="#B08D57"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
