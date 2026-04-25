// Pure financial calculations for real estate deal underwriting.
// All functions are pure. All rates are decimals (5% = 0.05). All currency is USD.

const OPEX_GROWTH_RATE = 0.025;
const SELLING_COST_PCT = 0.02;

export function mortgagePayment(loan, annualRate, amortYears) {
  if (loan <= 0 || amortYears <= 0) return 0;
  const n = amortYears * 12;
  if (annualRate === 0) return loan / n;
  const r = annualRate / 12;
  return (loan * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

export function annualDebtService(loan, annualRate, amortYears) {
  return mortgagePayment(loan, annualRate, amortYears) * 12;
}

export function loanBalanceAfterYears(loan, annualRate, amortYears, k) {
  if (loan <= 0 || amortYears <= 0) return 0;
  if (k <= 0) return loan;
  if (k >= amortYears) return 0;
  const n = amortYears * 12;
  const months = k * 12;
  if (annualRate === 0) {
    const payment = loan / n;
    return Math.max(0, loan - payment * months);
  }
  const r = annualRate / 12;
  const pow = Math.pow(1 + r, n);
  const powK = Math.pow(1 + r, months);
  return loan * ((pow - powK) / (pow - 1));
}

export function effectiveGrossIncome(grossRent, vacancyPct) {
  return grossRent * (1 - vacancyPct);
}

export function operatingExpenses(input, egi) {
  if (input.mode === 'percent') {
    return egi * input.percent;
  }
  const i = input.itemized || {};
  return (
    (i.taxes || 0) +
    (i.insurance || 0) +
    (i.management || 0) +
    (i.maintenance || 0) +
    (i.utilities || 0) +
    (i.reserves || 0)
  );
}

export function noi(egi, opex) {
  return egi - opex;
}

export function capRate(noiValue, askingPrice) {
  if (askingPrice <= 0) return 0;
  return noiValue / askingPrice;
}

export function dscr(noiValue, debtService) {
  if (debtService <= 0) return Infinity;
  return noiValue / debtService;
}

export function projectYears(deal, years = 10) {
  const ds = annualDebtService(deal.loanAmount, deal.interestRate, deal.amortYears);
  const out = [];
  let cumulative = 0;
  for (let y = 1; y <= years; y++) {
    const grossRent = deal.grossRent * Math.pow(1 + deal.rentGrowth, y - 1);
    const egi = effectiveGrossIncome(grossRent, deal.vacancyRate);
    const opexY1 = operatingExpenses(deal.opex, effectiveGrossIncome(deal.grossRent, deal.vacancyRate));
    const opex = opexY1 * Math.pow(1 + OPEX_GROWTH_RATE, y - 1);
    const noiY = egi - opex;
    const cashFlow = noiY - ds;
    cumulative += cashFlow;
    out.push({
      year: y,
      grossRent,
      egi,
      opex,
      noi: noiY,
      debtService: ds,
      cashFlow,
      cumulativeCashFlow: cumulative,
    });
  }
  return out;
}

export function exitValue(noiYearAfterExit, exitCapRate) {
  if (exitCapRate <= 0) return 0;
  return noiYearAfterExit / exitCapRate;
}

export function saleProceeds(exitVal, loanBalance, sellingCostPct = SELLING_COST_PCT) {
  return exitVal * (1 - sellingCostPct) - loanBalance;
}

// IRR via bisection. Returns null if undefined (e.g., no sign change in cashflows).
// cashflows[0] should be the negative initial equity; subsequent are annual flows.
export function irr(cashflows) {
  if (!cashflows || cashflows.length < 2) return null;
  const total = cashflows.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;
  let hasNeg = false;
  let hasPos = false;
  for (const v of cashflows) {
    if (v < 0) hasNeg = true;
    if (v > 0) hasPos = true;
  }
  if (!hasNeg || !hasPos) return null;

  const npv = (rate) => {
    let v = 0;
    for (let i = 0; i < cashflows.length; i++) {
      v += cashflows[i] / Math.pow(1 + rate, i);
    }
    return v;
  };

  let lo = -0.99;
  let hi = 10.0;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (fLo * fHi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7 || (hi - lo) / 2 < 1e-9) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

export function equityMultiple(annualCashFlows, saleProceedsAtExit, initialEquity) {
  if (initialEquity <= 0) return null;
  const totalIn = annualCashFlows.reduce((s, v) => s + v, 0) + saleProceedsAtExit;
  return totalIn / initialEquity;
}

// Orchestrator. Returns inputs (echoed), metrics, projections, sensitivity grid.
export function runUnderwrite(deal) {
  const projections = projectYears(deal, 10);
  const y1 = projections[0];
  const ds = y1.debtService;
  const initialEquity = Math.max(0, deal.askingPrice - deal.loanAmount);
  const goingInCap = capRate(y1.noi, deal.askingPrice);

  const hold = clamp(deal.holdPeriod, 1, 10);
  const exitProj = projectYears(deal, hold + 1);
  const noiAtExitPlusOne = exitProj[hold].noi;
  const exitVal = exitValue(noiAtExitPlusOne, deal.exitCapRate);
  const loanBalAtExit = loanBalanceAfterYears(deal.loanAmount, deal.interestRate, deal.amortYears, hold);
  const proceeds = saleProceeds(exitVal, loanBalAtExit);

  const irrFlows = [-initialEquity];
  for (let y = 1; y <= hold; y++) {
    const cf = projections[y - 1].cashFlow + (y === hold ? proceeds : 0);
    irrFlows.push(cf);
  }
  const irrValue = irr(irrFlows);
  const annualFlows = projections.slice(0, hold).map((p) => p.cashFlow);
  const eqMult = equityMultiple(annualFlows, proceeds, initialEquity);

  const cashOnCash = initialEquity > 0 ? y1.cashFlow / initialEquity : null;

  // 3x3 sensitivity grid: exit cap (rows) x rent growth (cols) -> IRR
  const exitCapAxis = [deal.exitCapRate - 0.005, deal.exitCapRate, deal.exitCapRate + 0.005];
  const rentGrowthAxis = [
    Math.max(0, deal.rentGrowth - 0.01),
    deal.rentGrowth,
    deal.rentGrowth + 0.01,
  ];
  const sensitivity = exitCapAxis.map((ec) =>
    rentGrowthAxis.map((rg) => {
      const altDeal = { ...deal, exitCapRate: ec, rentGrowth: rg };
      return computeIRR(altDeal, hold, initialEquity);
    })
  );

  return {
    inputs: deal,
    metrics: {
      egi: y1.egi,
      noi: y1.noi,
      capRate: goingInCap,
      annualDebtService: ds,
      cashOnCash,
      dscr: dscr(y1.noi, ds),
      irr: irrValue,
      equityMultiple: eqMult,
      initialEquity,
      exitValue: exitVal,
      loanBalanceAtExit: loanBalAtExit,
      saleProceeds: proceeds,
    },
    projections,
    sensitivity,
    sensitivityAxes: { exitCap: exitCapAxis, rentGrowth: rentGrowthAxis },
  };
}

function computeIRR(deal, hold, initialEquity) {
  const proj = projectYears(deal, hold + 1);
  const noiNext = proj[hold].noi;
  const exitVal = exitValue(noiNext, deal.exitCapRate);
  const loanBal = loanBalanceAfterYears(deal.loanAmount, deal.interestRate, deal.amortYears, hold);
  const proceeds = saleProceeds(exitVal, loanBal);
  const flows = [-initialEquity];
  for (let y = 1; y <= hold; y++) {
    flows.push(proj[y - 1].cashFlow + (y === hold ? proceeds : 0));
  }
  return irr(flows);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
