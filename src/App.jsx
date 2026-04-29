import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import DealForm from './components/DealForm.jsx';
import KeyMetrics from './components/KeyMetrics.jsx';
import ProjectionsTable from './components/ProjectionsTable.jsx';
import ProjectionsChart from './components/ProjectionsChart.jsx';
import SensitivityTable from './components/SensitivityTable.jsx';
import MemoSection from './components/MemoSection.jsx';
import ExportButton from './components/ExportButton.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import { runUnderwrite, capRate, effectiveGrossIncome, operatingExpenses } from './lib/financials.js';

const DEFAULT_DEAL = {
  propertyName: 'The Heights at Crown',
  address: '425 Crown St, Brooklyn, NY 11225',
  assetClass: 'multifamily',
  units: 50,
  squareFootage: 0,
  purchasePrice: 10_000_000,
  grossRent: 1_200_000,
  vacancyRate: 0.05,
  opex: {
    mode: 'itemized',
    percent: 0.35,
    itemized: {
      contracts: 30_000,
      payroll: 60_000,
      repairsAndMaintenance: 50_000,
      administrative: 25_000,
      management: 50_000,
      utilities: 30_000,
      reTaxes: 120_000,
      insurance: 25_000,
      marketing: 15_000,
      turnover: 20_000,
    },
  },
  loanAmount: 7_000_000,
  interestRate: 0.065,
  amortYears: 30,
  ioPeriodYears: 0,
  closingCostsPct: 0.02,
  capitalImprovements: 250_000,
  workingCapital: 150_000,
  rentGrowth: 0.03,
  expenseGrowth: 0.025,
  holdPeriod: 5,
  exitCapRate: 0.06,
};

export default function App() {
  const [deal, setDeal] = useState(DEFAULT_DEAL);
  const [memo, setMemo] = useState('');
  const [auth, setAuth] = useState({ status: 'loading', authRequired: true });

  useEffect(() => {
    fetch('/api/session')
      .then((r) => r.json())
      .then((d) =>
        setAuth({
          status: d.authenticated ? 'authed' : 'login',
          authRequired: d.authRequired,
        })
      )
      .catch(() => setAuth({ status: 'login', authRequired: true }));
  }, []);

  const onSignOut = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setAuth({ status: 'login', authRequired: true });
    setMemo('');
  };

  const result = useMemo(() => runUnderwrite(deal), [deal]);

  // Suggested exit cap = going-in + 50bps, displayed as a hint near the exit cap input.
  const suggestedExitCap = useMemo(() => {
    const egi = effectiveGrossIncome(deal.grossRent, deal.vacancyRate);
    const opex = operatingExpenses(deal.opex, egi);
    const noiY1 = egi - opex;
    return capRate(noiY1, deal.purchasePrice) + 0.005;
  }, [deal]);

  if (auth.status === 'loading') {
    return (
      <div className="min-h-screen bg-navy-deep flex items-center justify-center">
        <div className="text-gold-soft text-sm uppercase tracking-[0.3em]">Loading…</div>
      </div>
    );
  }

  if (auth.status === 'login') {
    return (
      <LoginScreen
        onAuthenticated={() => setAuth({ status: 'authed', authRequired: true })}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header showSignOut={auth.authRequired} onSignOut={onSignOut} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <DealForm deal={deal} setDeal={setDeal} suggestedExitCap={suggestedExitCap} />
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="rvc-card p-5">
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                <h2 className="font-serif text-lg text-navy">Underwriting Snapshot</h2>
                <ExportButton
                  inputs={result.inputs}
                  metrics={result.metrics}
                  projections={result.projections}
                  sensitivity={result.sensitivity}
                  axes={result.sensitivityAxes}
                  memo={memo}
                />
              </div>
              <KeyMetrics metrics={result.metrics} />
            </div>

            <ProjectionsChart
              projections={result.projections}
              holdPeriod={result.inputs.holdPeriod}
            />

            <ProjectionsTable
              projections={result.projections}
              holdPeriod={result.inputs.holdPeriod}
            />

            <SensitivityTable
              sensitivity={result.sensitivity}
              axes={result.sensitivityAxes}
            />

            <MemoSection
              inputs={result.inputs}
              metrics={result.metrics}
              projections={result.projections}
              memo={memo}
              setMemo={setMemo}
            />
          </div>
        </div>
      </main>
      <footer className="bg-navy-deep text-slate-300 text-xs py-3 text-center">
        Rose Valley Capital · Confidential · Internal underwriting tool
      </footer>
    </div>
  );
}
