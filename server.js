import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import * as XLSX from 'xlsx';
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

  return `You are a senior acquisitions analyst at Rose Valley Capital, a $2B+ AUM vertically integrated real estate investment firm. You are writing an acquisitions memo for the principal — your boss — who will use it to decide whether to advance the opportunity to LOI / IC. Write the way an acquisitions team writes for an investment committee: precise, decisive, numerically rigorous, no fluff.

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

YEAR-1 BASIS
- Mode: ${inputs.useProjectedYearOne ? 'User-projected Year 1 drives the multi-year forecast' : 'In-place / T12 drives the multi-year forecast'}
- T12 gross rent: ${dollars(inputs.t12?.grossRent)} (vacancy ${pct(inputs.t12?.vacancyRate)})${
    inputs.useProjectedYearOne
      ? `
- Year-1 projected gross rent: ${dollars(inputs.yearOne?.grossRent)} (vacancy ${pct(inputs.yearOne?.vacancyRate)})`
      : ''
  }

ASSUMPTIONS
- Rent growth: ${pct(inputs.rentGrowth)}
- Expense increase rate: ${pct(inputs.expenseGrowth)}
- Exit cap rate: ${pct(inputs.exitCapRate)}

PROJECTIONS
${projectionLines}
${compsSection}
NUMBER FORMATTING — STRICT
Match the exact formatting used above whenever you cite a figure:
- Dollar amounts: always with leading "$" and comma thousands separators. Examples: $10,000,000 — $1,234,567 — $44,245.
- Percentages: always with "%" and 2 decimal places. Examples: 6.50%, 1.85%, 12.34%.
- Multiples: number with "x" suffix and 2 decimal places. Examples: 1.85x, 2.10x.
- Ratios (DSCR): 2 decimal places, no symbol. Examples: 1.50, 1.21.
Never write a financial figure as a bare number. Round to whole dollars unless the cents matter.

VOICE
Write as a senior acquisitions analyst speaking to a principal you respect. Be direct and decisive — no hedging language ("could be", "may be"), no marketing copy. Cite specific figures rather than vague qualifiers ("strong returns" → "12.40% IRR on a 5-year hold"). When you flag a risk, name it and quantify it.

FILL-INS
You only have the financial data provided above. The principal also cares about items the data does not cover — submarket rent and occupancy trends, micro-market supply pipeline, sponsor or co-GP context, broker / leasing dynamics, condition of the asset, environmental and title items, employer concentration, etc. Wherever such a topic naturally belongs in the memo, leave a clearly-marked bracketed placeholder for the analyst to complete from outside diligence. Format placeholders exactly like:
- [FILL IN: submarket rent trend last 24 months]
- [FILL IN: top employers within 3 miles]
- [FILL IN: sponsor / GP track record]
- [FILL IN: recent capex / unit condition notes]
Do NOT invent or guess at facts you do not have. Place fill-ins inline in the narrative or bullets where they belong — not in a separate section. Aim for at least 3–5 fill-ins distributed throughout the memo.

STRUCTURE
Write a memo with these exact bolded markdown headers, in this order:

**Investment Thesis** — 2–3 sentences. Why is this attractive? Lead with the headline numbers.

**Strengths** — 3–4 bullets. Each bullet must reference at least one specific figure from above (using the formatting rules).

**Risks & Considerations** — 3–4 bullets. Same rule: name the risk and quantify it (DSCR, leverage, expense growth, exit cap sensitivity, market dependency, etc.).

**Recommendation** — One paragraph. Open with one of: "PROCEED.", "PROCEED WITH CAVEATS.", or "PASS." Then explain why in 3–5 sentences, citing the IRR, equity multiple, and the single most important risk.

Total length: 300–400 words. No preamble, no salutation, no sign-off. Start directly with the first header.`;
}

// --- Document extraction endpoint (T12 Excel + OM PDF) ---

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

app.post('/api/extract', requireAuth, upload.single('file'), async (req, res) => {
  if (!anthropic) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY not configured.',
    });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const kind = (req.body.kind || '').toString();
  if (kind !== 't12' && kind !== 'om') {
    return res.status(400).json({ error: 'kind must be t12 or om.' });
  }

  try {
    let messageContent;

    if (kind === 't12') {
      // Parse Excel/CSV server-side, send extracted text to Claude
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetTexts = wb.SheetNames.map((name) => {
        const sheet = wb.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        return `--- SHEET: ${name} ---\n${csv}`;
      }).join('\n\n');
      messageContent = [
        {
          type: 'text',
          text: buildExtractPrompt('t12') + '\n\nDOCUMENT CONTENT:\n' + sheetTexts,
        },
      ];
    } else {
      // PDF: pass directly via document content block
      const b64 = req.file.buffer.toString('base64');
      messageContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: b64 },
        },
        { type: 'text', text: buildExtractPrompt('om') },
      ];
    }

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2000,
      messages: [{ role: 'user', content: messageContent }],
    });
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const fields = parseExtractionJSON(text);
    res.json({ fields });
  } catch (err) {
    console.error('Extract error:', err);
    res.status(500).json({ error: err.message || 'Extraction failed.' });
  }
});

function buildExtractPrompt(kind) {
  const t12Schema = `
Return ONLY a JSON object inside a \`\`\`json fenced block. Extract only fields you find with high confidence — omit any field you cannot confidently identify. Do NOT guess.

If this is a T12 (trailing-12-months) operating statement, extract:
{
  "t12": {
    "grossRent": <number, total annual gross rental income>,
    "vacancyRate": <decimal, e.g. 0.05 for 5%>,
    "opex": {
      "mode": "itemized",
      "itemized": {
        "contracts": <number>,
        "payroll": <number>,
        "repairsAndMaintenance": <number>,
        "administrative": <number>,
        "management": <number>,
        "utilities": <number>,
        "reTaxes": <number>,
        "insurance": <number>,
        "marketing": <number>,
        "turnover": <number>
      }
    }
  }
}
Map the T12 line items to the closest of these 10 categories. Combine sub-line-items into the parent category where appropriate (e.g., trash + water + electric → utilities). Use whole-dollar annual totals.`;

  const omSchema = `
Return ONLY a JSON object inside a \`\`\`json fenced block. Extract only fields you find with high confidence — omit any field you cannot confidently identify. Do NOT guess.

If this is an Offering Memorandum, extract any of these top-level fields you find:
{
  "propertyName": <string>,
  "address": <string>,
  "assetClass": <"multifamily" | "office" | "retail" | "industrial" | "coworking">,
  "units": <number, only for multifamily>,
  "squareFootage": <number, only for non-multifamily>,
  "yearBuilt": <number>,
  "yearRenovated": <number>,
  "numBuildings": <number>,
  "numStories": <number>,
  "lotSizeSF": <number>,
  "grossBuildingSF": <number>,
  "parkingSpaces": <number>,
  "amenities": <string, comma-separated list>,
  "lastSalePrice": <number>,
  "lastSaleDate": <"YYYY-MM-DD">,
  "purchasePrice": <number, the asking price>,
  "loanAmount": <number, only if disclosed>,
  "interestRate": <decimal, only if disclosed>
}`;

  return `You are an extraction tool. ${kind === 't12' ? t12Schema : omSchema}\n\nIf no fields can be extracted, return: \`\`\`json\n{}\n\`\`\``;
}

function parseExtractionJSON(text) {
  if (!text) return {};
  // Pull the first ```json ... ``` block, fallback to whole text
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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
