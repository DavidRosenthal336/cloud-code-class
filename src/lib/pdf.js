import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { fmtCurrency, fmtPercent, fmtMultiple, fmtRatio } from './format.js';

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

  // Sensitivity
  y = doc.lastAutoTable.finalY + 24;
  sectionHeading(doc, 'Sensitivity Analysis — IRR', margin, y);
  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 5, halign: 'right' },
    headStyles: { fillColor: NAVY, textColor: '#ffffff', fontStyle: 'bold', halign: 'center' },
    head: [
      [
        'Exit Cap \\ Rent Growth',
        ...axes.rentGrowth.map((rg) => fmtPercent(rg)),
      ],
    ],
    body: sensitivity.map((row, ri) => [
      { content: fmtPercent(axes.exitCap[ri]), styles: { fontStyle: 'bold', halign: 'left' } },
      ...row.map((v, ci) => ({
        content: fmtPercent(v),
        styles:
          ri === 1 && ci === 1
            ? { fillColor: NAVY, textColor: '#ffffff', fontStyle: 'bold' }
            : {},
      })),
    ]),
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
  return [
    ['Property', inputs.propertyName || '—'],
    ['Address', inputs.address || '—'],
    ['Asset Class', capitalize(inputs.assetClass)],
    [
      'Size',
      inputs.assetClass === 'multifamily'
        ? `${inputs.units || 0} units`
        : `${(inputs.squareFootage || 0).toLocaleString()} SF`,
    ],
    ['Asking Price', fmtCurrency(inputs.askingPrice)],
    ['Loan Amount', fmtCurrency(inputs.loanAmount)],
    ['Interest Rate', fmtPercent(inputs.interestRate)],
    ['Amortization', `${inputs.amortYears} years`],
    ['Hold Period', `${inputs.holdPeriod} years`],
    ['Rent Growth', fmtPercent(inputs.rentGrowth)],
    ['Exit Cap Rate', fmtPercent(inputs.exitCapRate)],
  ];
}

function keyMetricsRows(m) {
  return [
    ['Effective Gross Income (Y1)', fmtCurrency(m.egi)],
    ['Net Operating Income (Y1)', fmtCurrency(m.noi)],
    ['Going-in Cap Rate', fmtPercent(m.capRate)],
    ['Annual Debt Service', fmtCurrency(m.annualDebtService)],
    ['Cash-on-Cash Return (Y1)', fmtPercent(m.cashOnCash)],
    ['Debt Service Coverage Ratio', fmtRatio(m.dscr)],
    ['Levered IRR', fmtPercent(m.irr)],
    ['Equity Multiple', fmtMultiple(m.equityMultiple)],
    ['Initial Equity', fmtCurrency(m.initialEquity)],
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
