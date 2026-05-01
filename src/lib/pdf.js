import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { fmtCurrency, fmtPercent, fmtMultiple, fmtRatio } from './format.js';
import { filterComps } from './comps.js';

const NAVY = '#0A1F44';
const GOLD = '#B08D57';
const SLATE = '#1F2937';

export async function exportMemoPDF({ inputs, metrics, projections, sensitivity, axes, memo }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  drawHeader(doc, pageW, margin);
  drawCover(doc, pageW, margin, inputs, dateStr);

  // Investment summary
  let y = 260;
  sectionHeading(doc, 'Investment Summary', margin, y);
  y += 14;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: { font: 'times', fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: NAVY, textColor: '#ffffff', font: 'helvetica', fontStyle: 'bold' },
    head: [['Item', 'Value']],
    body: investmentSummaryRows(inputs),
  });

  // Key metrics
  y = doc.lastAutoTable.finalY + 18;
  sectionHeading(doc, 'Key Metrics', margin, y);
  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { font: 'times', fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: NAVY, textColor: '#ffffff', font: 'helvetica', fontStyle: 'bold' },
    head: [['Metric', 'Value']],
    body: keyMetricsRows(metrics),
  });

  // Chart (try; if it fails we just skip)
  await tryAttachChart(doc, pageW, margin);

  // 10-year projections
  doc.addPage();
  drawHeader(doc, pageW, margin);
  sectionHeading(doc, '10-Year Projections', margin, 100);
  autoTable(doc, {
    startY: 110,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: NAVY, textColor: '#ffffff', fontStyle: 'bold' },
    head: [['Year', 'EGI', 'OpEx', 'NOI', 'Debt Service', 'Cash Flow', 'Cumulative CF']],
    body: projections.map((p) => [
      p.year + (p.year === inputs.holdPeriod ? ' (Exit)' : ''),
      fmtCurrency(p.egi),
      fmtCurrency(p.opex),
      fmtCurrency(p.noi),
      fmtCurrency(p.debtService),
      fmtCurrency(p.cashFlow),
      fmtCurrency(p.cumulativeCashFlow),
    ]),
  });

  // Sales Comps — only those matching the filter criteria
  const filteredComps = filterComps(inputs.salesComps, inputs.compsFilter, inputs.yearBuilt);
  if (filteredComps.length > 0) {
    y = doc.lastAutoTable.finalY + 24;
    sectionHeading(doc, 'Sales Comps', margin, y);
    const f = inputs.compsFilter || {};
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#64748b');
    doc.text(
      `Filters: within ${f.proximityMiles || 25} mi · ± ${f.vintageYears || 10} yr vintage · sold within last ${f.soldWithinYears || 3} yr`,
      margin,
      y + 14
    );
    autoTable(doc, {
      startY: y + 22,
      margin: { left: margin, right: margin },
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: NAVY, textColor: '#ffffff', fontStyle: 'bold' },
      head: [['Address', 'Yr Built', 'Dist (mi)', 'Date Sold', 'Price', 'Units', '$/Unit', 'Seller', 'Buyer']],
      body: filteredComps.map((c) => [
        c.address || '—',
        c.yearBuilt ? String(c.yearBuilt) : '—',
        c.distance ? c.distance.toString() : '—',
        c.dateSold || '—',
        fmtCurrency(c.price),
        String(c.units || 0),
        fmtCurrency(c.units > 0 ? c.price / c.units : 0),
        c.seller || '—',
        c.buyer || '—',
      ]),
    });
  }

  // Sensitivity — single-axis exit cap rate, 9 cells centered on input
  y = doc.lastAutoTable.finalY + 24;
  sectionHeading(doc, 'Sensitivity Analysis — IRR vs. Exit Cap', margin, y);
  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, halign: 'right' },
    headStyles: { fillColor: NAVY, textColor: '#ffffff', fontStyle: 'bold', halign: 'center' },
    head: [
      [
        { content: 'Exit Cap', styles: { halign: 'left' } },
        ...axes.exitCap.map((ec, i) => ({
          content: fmtPercent(ec),
          styles: i === 4 ? { fillColor: NAVY, textColor: '#ffffff', fontStyle: 'bold' } : {},
        })),
      ],
    ],
    body: [
      [
        { content: 'Levered IRR', styles: { halign: 'left', fontStyle: 'bold' } },
        ...sensitivity.map((v, i) => ({
          content: fmtPercent(v),
          styles: i === 4 ? { fillColor: NAVY, textColor: '#ffffff', fontStyle: 'bold' } : {},
        })),
      ],
    ],
  });

  // Narrative
  if (memo && memo.trim().length > 0) {
    doc.addPage();
    drawHeader(doc, pageW, margin);
    sectionHeading(doc, 'Investment Narrative', margin, 100);
    drawMemoText(doc, memo, margin, 118, pageW - margin * 2);
  }

  // Page footers on every page
  drawFooters(doc, pageW, margin, dateStr);

  const safeName = (inputs.propertyName || 'RVC-Deal')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .slice(0, 50);
  doc.save(`RVC_Memo_${safeName}.pdf`);
}

function drawHeader(doc, pageW, margin) {
  doc.setFillColor(NAVY);
  doc.rect(0, 0, pageW, 64, 'F');
  doc.setFillColor(GOLD);
  doc.rect(0, 64, pageW, 2, 'F');
  doc.setFont('times', 'normal');
  doc.setTextColor('#ffffff');
  doc.setFontSize(18);
  doc.text('Rose Valley Capital', margin, 34);
  doc.setFontSize(9);
  doc.setTextColor('#C9A878');
  doc.text('CONFIDENTIAL INVESTMENT MEMORANDUM', margin, 52);
}

function drawCover(doc, pageW, margin, inputs, dateStr) {
  doc.setTextColor(SLATE);
  doc.setFont('times', 'normal');
  doc.setFontSize(24);
  doc.text(inputs.propertyName || 'Untitled Deal', margin, 120);
  doc.setFontSize(11);
  doc.setTextColor('#475569');
  doc.text(inputs.address || '', margin, 140);
  doc.text(
    `${capitalize(inputs.assetClass)} • ${
      inputs.assetClass === 'multifamily'
        ? (inputs.units || 0) + ' units'
        : (inputs.squareFootage || 0).toLocaleString() + ' SF'
    }`,
    margin,
    158
  );
  doc.text(`Prepared ${dateStr}`, margin, 176);
}

function sectionHeading(doc, title, x, y) {
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(NAVY);
  doc.text(title, x, y);
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.6);
  doc.line(x, y + 3, x + 80, y + 3);
}

function investmentSummaryRows(inputs) {
  const start = inputs.useProjectedYearOne && inputs.yearOne ? inputs.yearOne : inputs.t12;
  const rows = [
    ['Property', inputs.propertyName || '—'],
    ['Address', inputs.address || '—'],
    ['Asset Class', capitalize(inputs.assetClass)],
    [
      'Size',
      inputs.assetClass === 'multifamily'
        ? `${inputs.units || 0} units`
        : `${(inputs.squareFootage || 0).toLocaleString()} SF`,
    ],
    ...(inputs.yearBuilt ? [['Year Built', String(inputs.yearBuilt)]] : []),
    ...(inputs.yearRenovated ? [['Year Renovated', String(inputs.yearRenovated)]] : []),
    ...(inputs.numBuildings ? [['Buildings', String(inputs.numBuildings)]] : []),
    ...(inputs.numStories ? [['Stories', String(inputs.numStories)]] : []),
    ...(inputs.grossBuildingSF
      ? [['Gross Building Area', `${inputs.grossBuildingSF.toLocaleString()} SF`]]
      : []),
    ...(inputs.lotSizeSF ? [['Lot Size', `${inputs.lotSizeSF.toLocaleString()} SF`]] : []),
    ...(inputs.parkingSpaces ? [['Parking Spaces', String(inputs.parkingSpaces)]] : []),
    ...(inputs.amenities ? [['Amenities', inputs.amenities]] : []),
    ...(inputs.lastSalePrice
      ? [['Last Sale', `${fmtCurrency(inputs.lastSalePrice)}${inputs.lastSaleDate ? ' on ' + inputs.lastSaleDate : ''}`]]
      : []),
    ['Purchase Price', fmtCurrency(inputs.purchasePrice)],
    ['Closing Costs', fmtPercent(inputs.closingCostsPct)],
    ['Capital Improvements', fmtCurrency(inputs.capitalImprovements)],
    ['Working Capital', fmtCurrency(inputs.workingCapital)],
    ['Loan Amount', fmtCurrency(inputs.loanAmount)],
    ['Interest Rate', fmtPercent(inputs.interestRate)],
    ['Amortization', `${inputs.amortYears} years`],
    ['Interest-Only Period', `${inputs.ioPeriodYears || 0} years`],
    ['Hold Period', `${inputs.holdPeriod} years`],
    [
      'Year-1 Basis',
      inputs.useProjectedYearOne ? 'User-projected Year 1' : 'In-place / T12',
    ],
    ['Vacancy Rate (start)', fmtPercent(start?.vacancyRate)],
    ['Rent Growth', fmtPercent(inputs.rentGrowth)],
    ['Expense Increase Rate', fmtPercent(inputs.expenseGrowth)],
    ['Exit Cap Rate', fmtPercent(inputs.exitCapRate)],
  ];
  if (inputs.valueAdd?.enabled) {
    const va = inputs.valueAdd;
    rows.push(
      ['Value-Add: Units', `${va.unitsToUpgrade || 0}`],
      ['Value-Add: Pace', `${va.unitsPerMonth || 0} units/mo`],
      ['Value-Add: Cost / Unit', fmtCurrency(va.costPerUnit)],
      ['Value-Add: Premium / Unit', `${fmtCurrency(va.premiumPerUnit)} / mo`],
      ['Value-Add: Total Capex', fmtCurrency((va.unitsToUpgrade || 0) * (va.costPerUnit || 0))]
    );
  }
  return rows;
}

function keyMetricsRows(m) {
  return [
    ['Effective Gross Income (Y1)', fmtCurrency(m.egi)],
    ['Total Operating Expenses (Y1)', fmtCurrency(m.totalExpenses)],
    ['Net Operating Income (Y1)', fmtCurrency(m.noi)],
    ['Going-in Cap Rate', fmtPercent(m.capRate)],
    ['Annual Debt Service (Y1)', fmtCurrency(m.annualDebtService)],
    ['Debt Service Coverage Ratio', fmtRatio(m.dscr)],
    ['Cash-on-Cash Return (Y1)', fmtPercent(m.cashOnCash)],
    ['Levered IRR', fmtPercent(m.irr)],
    ['Equity Multiple', fmtMultiple(m.equityMultiple)],
    ['Down Payment', fmtCurrency(m.downPayment)],
    ['Closing Costs', fmtCurrency(m.closingCosts)],
    ['Capital Improvements', fmtCurrency(m.capitalImprovements)],
    ['Working Capital', fmtCurrency(m.workingCapital)],
    ...(m.valueAddCapex > 0 ? [['Value-Add Capex', fmtCurrency(m.valueAddCapex)]] : []),
    ['Total Equity', fmtCurrency(m.totalEquity)],
    ['Projected Exit Value', fmtCurrency(m.exitValue)],
    ['Loan Balance at Exit', fmtCurrency(m.loanBalanceAtExit)],
    ['Projected Sale Proceeds', fmtCurrency(m.saleProceeds)],
  ];
}

async function tryAttachChart(doc, pageW, margin) {
  const el = document.getElementById('rvc-projections-chart');
  if (!el) return;
  try {
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
    const img = canvas.toDataURL('image/png');
    const pageH = doc.internal.pageSize.getHeight();
    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 200;
    const w = pageW - margin * 2;
    const ratio = canvas.height / canvas.width;
    const h = w * ratio;
    let yStart = finalY + 18;
    if (yStart + h > pageH - 60) {
      doc.addPage();
      drawHeader(doc, pageW, margin);
      yStart = 100;
    }
    doc.addImage(img, 'PNG', margin, yStart, w, h);
  } catch (e) {
    // chart capture is non-essential
  }
}

function drawMemoText(doc, memo, x, yStart, maxWidth) {
  const lines = memo.split('\n');
  let y = yStart;
  const pageH = doc.internal.pageSize.getHeight();

  const ensureSpace = (need) => {
    if (y + need > pageH - 60) {
      doc.addPage();
      drawHeader(doc, doc.internal.pageSize.getWidth(), 48);
      y = 100;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      y += 6;
      continue;
    }
    if (/^\*\*.+\*\*$/.test(line)) {
      ensureSpace(22);
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(NAVY);
      doc.text(line.replace(/\*\*/g, ''), x, y);
      y += 16;
      continue;
    }
    const isBullet = line.startsWith('- ') || line.startsWith('• ');
    const text = isBullet ? line.replace(/^[-•]\s+/, '') : line;
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(SLATE);
    const indent = isBullet ? 12 : 0;
    const wrapped = doc.splitTextToSize(text, maxWidth - indent);
    for (let i = 0; i < wrapped.length; i++) {
      ensureSpace(14);
      const prefix = isBullet && i === 0 ? '• ' : isBullet ? '  ' : '';
      doc.text(prefix + wrapped[i], x + indent - (isBullet && i === 0 ? 12 : 0), y);
      y += 14;
    }
    y += 2;
  }
}

function drawFooters(doc, pageW, margin, dateStr) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor('#e2e8f0');
    doc.line(margin, pageH - 36, pageW - margin, pageH - 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#64748b');
    doc.text(`Rose Valley Capital  •  Confidential  •  ${dateStr}`, margin, pageH - 22);
    doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 22, { align: 'right' });
  }
}

function capitalize(s) {
  if (!s) return '';
  return s[0].toUpperCase() + s.slice(1);
}
