import { describe, it, expect } from 'vitest';
import {
  mortgagePayment,
  annualDebtService,
  loanBalanceAfterYears,
  effectiveGrossIncome,
  operatingExpenses,
  noi,
  capRate,
  dscr,
  projectYears,
  exitValue,
  saleProceeds,
  irr,
  equityMultiple,
  runUnderwrite,
} from './financials.js';

const sampleDeal = {
  propertyName: 'Test Property',
  address: '123 Main St',
  assetClass: 'multifamily',
  units: 50,
  askingPrice: 10_000_000,
  grossRent: 1_200_000,
  vacancyRate: 0.05,
  opex: { mode: 'percent', percent: 0.35 },
  loanAmount: 7_000_000,
  interestRate: 0.065,
  amortYears: 30,
  rentGrowth: 0.03,
  holdPeriod: 5,
  exitCapRate: 0.06,
};

describe('mortgagePayment', () => {
  it('matches textbook formula for a 30-yr loan', () => {
    // $7M @ 6.5% / 30yr -> ~$44,244.76/mo
    const p = mortgagePayment(7_000_000, 0.065, 30);
    expect(p).toBeCloseTo(44244.76, 1);
  });

  it('handles zero interest rate', () => {
    const p = mortgagePayment(360_000, 0, 30);
    expect(p).toBeCloseTo(1000, 5);
  });

  it('returns 0 for zero loan', () => {
    expect(mortgagePayment(0, 0.05, 30)).toBe(0);
  });
});

describe('loanBalanceAfterYears', () => {
  it('returns full principal at year 0', () => {
    expect(loanBalanceAfterYears(7_000_000, 0.065, 30, 0)).toBe(7_000_000);
  });

  it('returns 0 at full amortization', () => {
    expect(loanBalanceAfterYears(7_000_000, 0.065, 30, 30)).toBe(0);
  });

  it('decreases monotonically', () => {
    const b1 = loanBalanceAfterYears(7_000_000, 0.065, 30, 1);
    const b5 = loanBalanceAfterYears(7_000_000, 0.065, 30, 5);
    const b10 = loanBalanceAfterYears(7_000_000, 0.065, 30, 10);
    expect(b1).toBeLessThan(7_000_000);
    expect(b5).toBeLessThan(b1);
    expect(b10).toBeLessThan(b5);
  });
});

describe('effectiveGrossIncome / opex / noi', () => {
  it('computes EGI from gross and vacancy', () => {
    expect(effectiveGrossIncome(1_000_000, 0.05)).toBe(950_000);
  });

  it('computes opex as percent of EGI', () => {
    expect(operatingExpenses({ mode: 'percent', percent: 0.4 }, 950_000)).toBe(380_000);
  });

  it('sums itemized opex', () => {
    const v = operatingExpenses(
      {
        mode: 'itemized',
        itemized: {
          taxes: 100_000,
          insurance: 25_000,
          management: 50_000,
          maintenance: 40_000,
          utilities: 30_000,
          reserves: 20_000,
        },
      },
      950_000
    );
    expect(v).toBe(265_000);
  });

  it('NOI is EGI minus OpEx', () => {
    expect(noi(950_000, 380_000)).toBe(570_000);
  });
});

describe('capRate / dscr', () => {
  it('computes going-in cap rate', () => {
    expect(capRate(570_000, 10_000_000)).toBeCloseTo(0.057);
  });

  it('returns 0 for zero asking price', () => {
    expect(capRate(100_000, 0)).toBe(0);
  });

  it('DSCR returns Infinity for all-cash deal', () => {
    expect(dscr(500_000, 0)).toBe(Infinity);
  });

  it('DSCR computes correctly with debt', () => {
    expect(dscr(570_000, 380_000)).toBeCloseTo(1.5);
  });
});

describe('projectYears', () => {
  it('projects 10 years with rent growth', () => {
    const p = projectYears(sampleDeal, 10);
    expect(p).toHaveLength(10);
    expect(p[0].year).toBe(1);
    expect(p[9].year).toBe(10);
    // Year 2 gross rent = Year 1 * (1 + growth)
    expect(p[1].grossRent).toBeCloseTo(sampleDeal.grossRent * 1.03);
  });

  it('cumulative cash flow accumulates', () => {
    const p = projectYears(sampleDeal, 5);
    const sum = p.reduce((s, r) => s + r.cashFlow, 0);
    expect(p[4].cumulativeCashFlow).toBeCloseTo(sum);
  });

  it('handles zero rent growth (flat)', () => {
    const p = projectYears({ ...sampleDeal, rentGrowth: 0 }, 5);
    expect(p[0].grossRent).toBeCloseTo(p[4].grossRent);
  });
});

describe('exitValue / saleProceeds', () => {
  it('exit value = NOI / cap rate', () => {
    expect(exitValue(600_000, 0.06)).toBe(10_000_000);
  });

  it('sale proceeds nets out selling costs and debt', () => {
    expect(saleProceeds(10_000_000, 6_500_000, 0.02)).toBe(10_000_000 * 0.98 - 6_500_000);
  });
});

describe('irr', () => {
  it('returns null when total cashflows are non-positive', () => {
    expect(irr([-100, 30, 30, 30])).toBe(null);
  });

  it('computes IRR for a simple case', () => {
    // -100, then 50 / 50 / 50 over 3 years -> IRR ~23.4%
    const r = irr([-100, 50, 50, 50]);
    expect(r).toBeCloseTo(0.2337, 3);
  });

  it('handles a real estate-shaped cashflow', () => {
    // -3M equity, 5 years of 100k cash flow + 3.5M sale proceeds in year 5
    const r = irr([-3_000_000, 100_000, 100_000, 100_000, 100_000, 100_000 + 3_500_000]);
    expect(r).toBeGreaterThan(0.03);
    expect(r).toBeLessThan(0.10);
  });

  it('returns null with no sign change', () => {
    expect(irr([100, 50, 50])).toBe(null);
  });
});

describe('equityMultiple', () => {
  it('computes em correctly', () => {
    const em = equityMultiple([100, 100, 100], 1500, 1000);
    // total = 300 + 1500 = 1800; em = 1.8
    expect(em).toBe(1.8);
  });

  it('returns null when no equity invested (all-debt theoretical)', () => {
    expect(equityMultiple([100], 100, 0)).toBe(null);
  });
});

describe('runUnderwrite (integration)', () => {
  it('returns the full underwriting payload', () => {
    const r = runUnderwrite(sampleDeal);
    expect(r.metrics.noi).toBeGreaterThan(0);
    expect(r.metrics.capRate).toBeGreaterThan(0.04);
    expect(r.metrics.capRate).toBeLessThan(0.10);
    expect(r.metrics.dscr).toBeGreaterThan(1);
    expect(r.projections).toHaveLength(10);
    expect(r.sensitivity).toHaveLength(3);
    expect(r.sensitivity[0]).toHaveLength(3);
    expect(typeof r.metrics.irr).toBe('number');
    expect(r.metrics.equityMultiple).toBeGreaterThan(1);
  });

  it('handles all-cash deal (no debt)', () => {
    const r = runUnderwrite({ ...sampleDeal, loanAmount: 0 });
    expect(r.metrics.dscr).toBe(Infinity);
    expect(r.metrics.annualDebtService).toBe(0);
    expect(r.metrics.initialEquity).toBe(sampleDeal.askingPrice);
  });

  it('handles 1-year hold', () => {
    const r = runUnderwrite({ ...sampleDeal, holdPeriod: 1 });
    expect(r.projections).toHaveLength(10);
    expect(r.metrics.equityMultiple).toBeGreaterThan(0);
  });
});
