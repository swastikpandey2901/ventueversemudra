import Anthropic from '@anthropic-ai/sdk';
import { COMPANIES } from '../data/companies';

// ─── AI & Autonomous News Analyzer ───────────────────────────────────────────
// 1. Prioritizes Groq / Claude if an API key is configured.
// 2. Seamlessly falls back to an intelligent built-in financial rule-engine
//    (ZERO API KEY REQUIRED) guaranteeing that publishing NEVER fails.
// 3. Strictly enforces that ALL affected tickers belong to the 30 Mudra stocks.

export const VALID_TICKERS = COMPANIES.map((c) => c.ticker);
const VALID_TICKER_SET = new Set(VALID_TICKERS);

const getCompanyList = () =>
  COMPANIES.map((c) => `${c.ticker} (${c.name}, ${c.sector}, Cap: ${c.category})`).join(', ');

const getSystemPrompt = () => `You are the lead algorithmic stock market analyst for MUDRA, a 7-day student trading simulation platform.
The market has EXACTLY these 30 companies (no other tickers exist in this world):
${getCompanyList()}

Analyze the given news article or social media post and determine how it impacts these specific stocks.
Respond with ONLY a valid, raw JSON object (no markdown quotes, no triple backticks, no explanations) in this exact schema:
{
  "affectedTickers": ["TICKER1", "TICKER2"],
  "sentiment": "positive" | "negative" | "neutral",
  "shockPercent": <number between -20.0 and 20.0>,
  "headline": "<punchy, professional financial news headline under 20 words>",
  "reasoning": "<one clear sentence explaining how the news causes this price shock>"
}

Rules:
- Select ONLY tickers that belong strictly to the 30 companies above.
- shockPercent represents immediate price movement (e.g. 8.5 for +8.5%, -6.2 for -6.2%).
- If news affects a sector, choose the matching Mudra companies in that sector.`;

// ─── SECTOR KEYWORD MAPPINGS (MUDRA 30 EQUITIES) ──────────────────────────────
const SECTOR_MAPPINGS = [
  {
    keywords: ['bank', 'banking', 'rbi', 'interest', 'rate', 'loan', 'repo', 'nii', 'credit', 'deposit', 'npa', 'fintech'],
    tickers: ['SBM', 'ICB', 'AXORA'],
  },
  {
    keywords: ['auto', 'car', 'ev', 'battery', 'vehicle', 'motor', 'truck', 'suv', 'mobility', 'automotive'],
    tickers: ['MATA', 'MHNDR', 'MUL'],
  },
  {
    keywords: ['tech', 'software', 'ai', 'cloud', 'chip', 'semiconductor', 'it', 'cyber', 'data', 'digital'],
    tickers: ['VNTR', 'MIS', 'UPDT', 'JIC'],
  },
  {
    keywords: ['oil', 'petrol', 'fuel', 'energy', 'gas', 'power', 'coal', 'solar', 'hydrogen', 'mining', 'port', 'refinery'],
    tickers: ['MPET', 'MDMP', 'COALM', 'ADANI'],
  },
  {
    keywords: ['pharma', 'drug', 'health', 'fda', 'medicine', 'hospital', 'vaccine', 'clinical', 'biotech'],
    tickers: ['DRANNA', 'PIPLA', 'PIO'],
  },
  {
    keywords: ['telecom', '5g', 'spectrum', 'network', 'flight', 'airline', 'aviation', 'airport', 'airfare'],
    tickers: ['AIRPEL', 'VITE', 'JORDAR'],
  },
  {
    keywords: ['fmcg', 'consumer', 'food', 'paint', 'salt', 'beauty', 'retail', 'grocery', 'inflation', 'cosmetics'],
    tickers: ['MDPAINTS', 'PALLEJI', 'SALT', 'LAKHME', 'HUDA'],
  },
  {
    keywords: ['infra', 'rail', 'railway', 'steel', 'forge', 'cement', 'construction', 'bridge', 'highway', 'heavy', 'engineering', 'polymer'],
    tickers: ['MDRAJ', 'MHEL', 'HRNE', 'PVS', 'XYZP'],
  },
];

// ─── BUILT-IN OFFLINE ANALYZER (NO API KEY REQUIRED) ─────────────────────────
export const analyzeBuiltInRuleBased = (newsText) => {
  const lower = newsText.toLowerCase();

  // 1. Direct Ticker and Company Name Matching
  const matchedTickers = new Set();
  COMPANIES.forEach((c) => {
    const tLower = c.ticker.toLowerCase();
    const nameLower = c.name.toLowerCase();
    const shortLower = c.shortName.toLowerCase();
    if (
      new RegExp(`\\b${tLower}\\b`, 'i').test(lower) ||
      lower.includes(nameLower) ||
      lower.includes(shortLower)
    ) {
      matchedTickers.add(c.ticker);
    }
  });

  // 2. Sector Keyword Matching
  if (matchedTickers.size === 0) {
    SECTOR_MAPPINGS.forEach((sec) => {
      const hits = sec.keywords.filter((kw) => lower.includes(kw));
      if (hits.length > 0) {
        sec.tickers.forEach((t) => matchedTickers.add(t));
      }
    });
  }

  // 3. Fallback: If no sector matched, pick 2 bellwether stocks
  if (matchedTickers.size === 0) {
    matchedTickers.add('SBM');
    matchedTickers.add('VNTR');
  }

  // Cap to top 3 relevant tickers to maintain focused price impact
  const affectedTickers = Array.from(matchedTickers).slice(0, 3);

  // 4. Sentiment Scoring
  const posWords = [
    'surge', 'jump', 'gain', 'profit', 'record', 'beat', 'expansion', 'award',
    'contract', 'bullish', 'rise', 'soar', 'upgraded', 'boost', 'grow', 'rally',
    'success', 'high', 'tender', 'dividend', 'revenue', 'green', 'breakthrough',
  ];
  const negWords = [
    'plunge', 'drop', 'loss', 'slump', 'fall', 'crash', 'delay', 'penalty',
    'shortage', 'ban', 'bearish', 'warn', 'decline', 'probe', 'scandal', 'deficit',
    'cut', 'disruption', 'fine', 'inflation', 'downgrade', 'fraud', 'strike',
  ];

  let score = 0;
  posWords.forEach((w) => {
    if (lower.includes(w)) score += 1;
  });
  negWords.forEach((w) => {
    if (lower.includes(w)) score -= 1;
  });

  let sentiment = 'neutral';
  let shockPercent = 1.5;
  if (score > 0) {
    sentiment = 'positive';
    shockPercent = Math.min(14.0, parseFloat((4.0 + score * 1.8).toFixed(1)));
  } else if (score < 0) {
    sentiment = 'negative';
    shockPercent = Math.max(-14.0, parseFloat((-4.0 + score * 1.8).toFixed(1)));
  }

  // 5. Generate Punchy Headline
  const firstSentence = newsText.split(/[.\n]/)[0].trim();
  const headline =
    firstSentence.length > 12 && firstSentence.length < 110
      ? firstSentence
      : `${affectedTickers.join(' & ')} Reacts as Market Evaluates Latest Corporate Developments`;

  const reasoning =
    sentiment === 'positive'
      ? `Favorable operational expansion and sector momentum trigger buying interest in ${affectedTickers.join(', ')}.`
      : sentiment === 'negative'
      ? `Margin pressure and heightened headwinds lead to near-term profit booking across ${affectedTickers.join(', ')}.`
      : `Macroeconomic equilibrium keeps valuation steady for ${affectedTickers.join(', ')}.`;

  return {
    affectedTickers,
    sentiment,
    shockPercent,
    headline,
    reasoning,
    engine: 'Autonomous Financial Engine (Zero Key Required)',
  };
};

// ─── Groq (Llama 3.3) ────────────────────────────────────────────────────────
export const analyzeWithGroq = async (newsText, customApiKey = null) => {
  const apiKey = customApiKey || import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq API Key is not configured');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: getSystemPrompt() },
        { role: 'user', content: newsText },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq API request failed: ${res.status} - ${errBody}`);
  }

  const data = await res.json();
  const raw = data.choices[0].message.content.trim();
  return JSON.parse(raw);
};

// ─── Claude (Anthropic) ───────────────────────────────────────────────────────
export const analyzeWithClaude = async (newsText, customApiKey = null) => {
  const apiKey = customApiKey || import.meta.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) throw new Error('Claude API Key is not configured');

  const client = new Anthropic({
    apiKey: apiKey.trim(),
    dangerouslyAllowBrowser: true,
  });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 600,
    system: getSystemPrompt(),
    messages: [{ role: 'user', content: newsText }],
  });

  let raw = message.content[0].text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(json)?\s*/i, '').replace(/```$/i, '').trim();
  }
  return JSON.parse(raw);
};

// ─── Main Dispatcher with Strict 30-Stock Sanitizer ──────────────────────────
export const analyzeNews = async (newsText, preferredEngine = 'groq', customKey = null) => {
  const groqKey = customKey || import.meta.env.VITE_GROQ_API_KEY;
  const claudeKey = customKey || import.meta.env.VITE_CLAUDE_API_KEY;

  let rawResult = null;

  // 1. Try Groq if configured
  if (preferredEngine === 'groq' && groqKey) {
    try {
      const res = await analyzeWithGroq(newsText, groqKey);
      rawResult = { ...res, engine: 'Groq (Llama 3.3 70B)' };
    } catch (err) {
      console.warn('Groq failed, trying Claude or built-in fallback:', err.message);
    }
  }

  // 2. Try Claude if Groq wasn't used or failed
  if (!rawResult && claudeKey) {
    try {
      const res = await analyzeWithClaude(newsText, claudeKey);
      rawResult = { ...res, engine: 'Claude Sonnet' };
    } catch (err) {
      console.warn('Claude failed, using built-in fallback:', err.message);
    }
  }

  // 3. Fallback to Autonomous Built-in Analyzer (No API key needed!)
  if (!rawResult) {
    rawResult = analyzeBuiltInRuleBased(newsText);
  }

  // 4. Strict Sanitizer: Ensure ALL tickers belong to the 30 Mudra companies
  let sanitizedTickers = (rawResult.affectedTickers || []).filter((t) =>
    VALID_TICKER_SET.has(t)
  );

  // If external LLM hallucinated non-existent stocks (e.g. AAPL, TSLA), extract matching Mudra stocks
  if (sanitizedTickers.length === 0) {
    const fallback = analyzeBuiltInRuleBased(newsText);
    sanitizedTickers = fallback.affectedTickers;
  }

  return {
    ...rawResult,
    affectedTickers: sanitizedTickers,
    shockPercent: Number(rawResult.shockPercent || 0),
  };
};
