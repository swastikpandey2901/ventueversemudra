import Anthropic from '@anthropic-ai/sdk';
import { COMPANIES } from '../data/companies';

// ─── AI News Analyzer ─────────────────────────────────────────────────────────
// Supports both Groq (ultra-fast Llama 3) and Claude (Anthropic).
// Prioritizes whichever API key is provided, defaulting to Groq if set.

const getCompanyList = () =>
  COMPANIES.map((c) => `${c.ticker} (${c.name}, ${c.sector}, Cap: ${c.category})`).join(', ');

const getSystemPrompt = () => `You are the lead algorithmic stock market analyst for MUDRA, a 7-day student trading simulation platform.
The market has exactly these 30 companies:
${getCompanyList()}

Analyze the given news article or social media post and determine how it impacts these specific stocks.
Respond with ONLY a valid, raw JSON object (no markdown quotes, no triple backticks, no explanations) in this exact schema:
{
  "affectedTickers": ["TICKER1", "TICKER2"],
  "sentiment": "positive" | "negative" | "neutral",
  "shockPercent": <number between -25.0 and 25.0>,
  "headline": "<punchy, professional financial news headline under 20 words>",
  "reasoning": "<one clear sentence explaining how the news causes this price shock>"
}

Rules:
- Select only tickers that belong to the 30 companies above.
- shockPercent represents immediate price movement (e.g. 14.5 for +14.5%, -8.2 for -8.2%).
- Large cap stocks should experience lower percentage volatility than Small cap stocks.
- If news is systemic or policy-based (e.g., GST changes, RBI rate hike), affect multiple relevant stocks in that sector.`;

// ─── Groq (Llama 3 - High Speed & Reliable) ───────────────────────────────────
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
  // Strip code block if returned
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(json)?\s*/i, '').replace(/```$/i, '').trim();
  }
  return JSON.parse(raw);
};

// ─── Main Dispatcher ─────────────────────────────────────────────────────────
export const analyzeNews = async (newsText, preferredEngine = 'groq', customKey = null) => {
  const groqKey = customKey || import.meta.env.VITE_GROQ_API_KEY;
  const claudeKey = customKey || import.meta.env.VITE_CLAUDE_API_KEY;

  if (preferredEngine === 'groq' && groqKey) {
    try {
      const result = await analyzeWithGroq(newsText, groqKey);
      return { ...result, engine: 'Groq (Llama 3.3 70B)' };
    } catch (err) {
      console.warn('Groq failed, attempting Claude fallback:', err.message);
      if (claudeKey) {
        const result = await analyzeWithClaude(newsText, claudeKey);
        return { ...result, engine: 'Claude (Fallback)' };
      }
      throw err;
    }
  }

  if (claudeKey) {
    try {
      const result = await analyzeWithClaude(newsText, claudeKey);
      return { ...result, engine: 'Claude Sonnet' };
    } catch (err) {
      console.warn('Claude failed, attempting Groq fallback:', err.message);
      if (groqKey) {
        const result = await analyzeWithGroq(newsText, groqKey);
        return { ...result, engine: 'Groq (Fallback)' };
      }
      throw err;
    }
  }

  if (groqKey) {
    const result = await analyzeWithGroq(newsText, groqKey);
    return { ...result, engine: 'Groq (Llama 3.3)' };
  }

  throw new Error('Please configure a Groq or Claude API key in your .env or God Panel.');
};
