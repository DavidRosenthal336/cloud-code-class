import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { filterComps as filterCompsServerSide } from './src/lib/comps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3001;

const APP_PASSWORD = process.env.APP_PASSWORD || '';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  (isProd ? '' : 'dev-only-insecure-session-secret-change-in-prod');
const SESSION_COOKIE = 'rvc_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

function signSession(expiresAt) {
  const payload = String(expiresAt);
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySession(token) {
  if (!token || !SESSION_SECRET) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return true;
}

function authBypassed() {
  return !APP_PASSWORD;
}

function isAuthed(req) {
  if (authBypassed()) return true;
  return verifySession(req.cookies?.[SESSION_COOKIE]);
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  return res.status(401).json({ error: 'Authentication required.' });
}

app.get('/api/session', (req, res) => {
  res.json({ authenticated: isAuthed(req), authRequired: !authBypassed() });
});

app.post('/api/login', (req, res) => {
  if (authBypassed()) return res.json({ ok: true });
  const { password } = req.body || {};
  if (typeof password !== 'string' || password !== APP_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = signSession(expiresAt);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.post('/api/generate-memo', requireAuth, async (req, res) => {
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

  const filtered = filterCompsServerSide(
    inputs.salesComps,
    inputs.compsFilter,
    inputs.yearBuilt
  );
  const f = inputs.compsFilter || {};
  const compsSection =
    filtered.length > 0
      ? `\nSALES COMPS (within ${f.proximityMiles || 25} mi, ± ${f.vintageYears || 10} yr vintage, sold within last ${f.soldWithinYears || 3} yr)\n${filtered
          .map((c) => {
            const ppu = c.units > 0 ? c.price / c.units : 0;
            const parties =
              c.seller || c.buyer ? ` — ${c.seller || '?'} → ${c.buyer || '?'}` : '';
            const vintage = c.yearBuilt ? `, built ${c.yearBuilt}` : '';
            const dist = c.distance ? `, ${c.distance} mi` : '';
            return `- ${c.address || 'Unnamed'} (${c.dateSold || 'date unknown'}${vintage}${dist}): ${dollars(c.price)} / ${c.units || 0} units = ${dollars(ppu)}/unit${parties}`;
          })
          .join('\n')}\n`
      : '';

  return `You are a senior real estate underwriter at Rose Valley Capital, a $2B+ AUM vertically integrated real estate investment firm. Write a concise, institutional-quality investment memo for the deal below. The reader is a senior principal — be direct, balanced, and specific.

DEAL OVERVIEW
- Property: ${inputs.propertyName || 'Unnamed'}
- Address: ${inputs.address || 'Not specified'}
- Asset class: ${inputs.assetClass}
- Size: ${inputs.units ? inputs.units + ' units' : (inputs.squareFootage || 0).toLocaleString() + ' SF'}
- Purchase price: ${dollars(inputs.purchasePrice)}

CAPITAL STACK
- Loan amount: ${dollars(inputs.loanAmount)} @ ${pct(inputs.interestRate)} (${inputs.amortYears}-yr amort, ${inputs.ioPeriodYears || 0}-yr IO)
- Down payment: ${dollars(metrics.downPayment)}
- Closing costs: ${dollars(metrics.closingCosts)} (${pct(inputs.closingCostsPct)})
- Capital improvements: ${dollars(metrics.capitalImprovements)}
- Working capital: ${dollars(metrics.workingCapital)}${
    inputs.valueAdd?.enabled
      ? `
- Value-add capex: ${dollars(metrics.valueAddCapex)} (${inputs.valueAdd.unitsToUpgrade} units @ ${dollars(inputs.valueAdd.costPerUnit)}/unit, paced at ${inputs.valueAdd.unitsPerMonth}/mo, $${inputs.valueAdd.premiumPerUnit}/mo premium)`
      : ''
  }
- Total equity: ${dollars(metrics.totalEquity)}

FINANCIAL METRICS
- Effective Gross Income (Y1): ${dollars(metrics.egi)}
- Total Operating Expenses (Y1): ${dollars(metrics.totalExpenses)}
- Net Operating Income (Y1): ${dollars(metrics.noi)}
- Going-in cap rate: ${pct(metrics.capRate)}
- Annual debt service (Y1): ${dollars(metrics.annualDebtService)}
- DSCR (Y1): ${fmt(metrics.dscr)}
- Cash-on-Cash return (Y1): ${pct(metrics.cashOnCash)}
- Levered IRR (${inputs.holdPeriod}-yr hold): ${pct(metrics.irr)}
- Equity multiple: ${fmt(metrics.equityMultiple)}x
- Exit value: ${dollars(metrics.exitValue)}
- Sale proceeds: ${dollars(metrics.saleProceeds)}

ASSUMPTIONS
- Vacancy: ${pct(inputs.vacancyRate)}
- Rent growth: ${pct(inputs.rentGrowth)}
- Expense increase rate: ${pct(inputs.expenseGrowth)}
- Exit cap rate: ${pct(inputs.exitCapRate)}

PROJECTIONS
${projectionLines}
${compsSection}
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
