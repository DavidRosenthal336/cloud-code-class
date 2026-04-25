import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3001;

const app = express();
app.use(express.json({ limit: '1mb' }));

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

app.post('/api/generate-memo', async (req, res) => {
  if (!anthropic) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY not configured. Copy .env.example to .env and set the key.',
    });
  }

  const { inputs, metrics, projections } = req.body || {};
  if (!inputs || !metrics || !projections) {
    return res.status(400).json({ error: 'Missing inputs, metrics, or projections in request body.' });
  }

  const prompt = buildMemoPrompt(inputs, metrics, projections);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    res.json({ memo: text });
  } catch (err) {
    console.error('Anthropic error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate memo.' });
  }
});

function buildMemoPrompt(inputs, metrics, projections) {
  const fmt = (n, d = 2) =>
    typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'N/A';
  const pct = (n) => (typeof n === 'number' && Number.isFinite(n) ? (n * 100).toFixed(2) + '%' : 'N/A');
  const dollars = (n) =>
    typeof n === 'number' && Number.isFinite(n)
      ? '$' + Math.round(n).toLocaleString('en-US')
      : 'N/A';

  const projectionLines = projections
    .map(
      (p) =>
        `  Year ${p.year}: NOI ${dollars(p.noi)}, CF ${dollars(p.cashFlow)}, Cumulative CF ${dollars(p.cumulativeCashFlow)}`
    )
    .join('\n');

  return `You are a senior real estate underwriter at Rose Valley Capital, a $2B+ AUM vertically integrated real estate investment firm. Write a concise, institutional-quality investment memo for the deal below. The reader is a senior principal — be direct, balanced, and specific.

DEAL OVERVIEW
- Property: ${inputs.propertyName || 'Unnamed'}
- Address: ${inputs.address || 'Not specified'}
- Asset class: ${inputs.assetClass}
- Size: ${inputs.units ? inputs.units + ' units' : (inputs.squareFootage || 0).toLocaleString() + ' SF'}
- Asking price: ${dollars(inputs.askingPrice)}

FINANCIAL METRICS
- Effective Gross Income (Y1): ${dollars(metrics.egi)}
- Net Operating Income (Y1): ${dollars(metrics.noi)}
- Going-in cap rate: ${pct(metrics.capRate)}
- Cash-on-Cash return (Y1): ${pct(metrics.cashOnCash)}
- DSCR: ${fmt(metrics.dscr)}
- Annual debt service: ${dollars(metrics.annualDebtService)}
- Levered IRR (${inputs.holdPeriod}-yr hold): ${pct(metrics.irr)}
- Equity multiple: ${fmt(metrics.equityMultiple)}x
- Initial equity: ${dollars(metrics.initialEquity)}
- Exit value: ${dollars(metrics.exitValue)}
- Exit cap rate assumption: ${pct(inputs.exitCapRate)}
- Rent growth assumption: ${pct(inputs.rentGrowth)}

PROJECTIONS
${projectionLines}

INSTRUCTIONS
Write a 4-paragraph memo with these sections (use the exact headers, bold them with markdown):

**Investment Thesis** — Why is this an interesting opportunity? 2-3 sentences.

**Strengths** — 3-4 specific positives, in a bulleted list. Reference actual numbers from the deal.

**Risks & Considerations** — 3-4 specific risks or items to diligence, in a bulleted list. Reference actual numbers.

**Recommendation** — A clear one-paragraph recommendation: PROCEED, PROCEED WITH CAVEATS, or PASS, and why. Be decisive.

Total memo should be ~300-400 words. No preamble, no sign-off. Start directly with the first header.`;
}

async function start() {
  if (isProd) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`\n  Rose Valley Capital — Deal Underwriting`);
    console.log(`  ${isProd ? 'Production' : 'Development'} server on http://localhost:${port}\n`);
  });
}

start().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
