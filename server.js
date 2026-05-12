const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Yahoo Finance proxy - get stock quote
app.get('/api/quote/:ticker', async (req, res) => {
  const { ticker } = req.params;
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: 'Ticker not found' });

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose;
    const change = price - prev;
    const changePct = (change / prev) * 100;

    res.json({
      ticker: meta.symbol,
      price: price.toFixed(2),
      change: change.toFixed(2),
      changePct: changePct.toFixed(2),
      high: meta.regularMarketDayHigh?.toFixed(2),
      low: meta.regularMarketDayLow?.toFixed(2),
      volume: meta.regularMarketVolume?.toLocaleString(),
      marketCap: meta.marketCap,
      exchange: meta.exchangeName,
      currency: meta.currency,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Yahoo Finance - get key financials
app.get('/api/financials/:ticker', async (req, res) => {
  const { ticker } = req.params;
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker.toUpperCase()}?modules=financialData,defaultKeyStatistics,summaryDetail,assetProfile`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await response.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) return res.status(404).json({ error: 'No data found' });

    const fd = result.financialData || {};
    const ks = result.defaultKeyStatistics || {};
    const sd = result.summaryDetail || {};
    const ap = result.assetProfile || {};

    res.json({
      name: ap.longName || ticker,
      sector: ap.sector || 'N/A',
      industry: ap.industry || 'N/A',
      description: ap.longBusinessSummary?.slice(0, 400) + '...' || 'N/A',
      employees: ap.fullTimeEmployees?.toLocaleString() || 'N/A',
      website: ap.website || 'N/A',
      peRatio: sd.trailingPE?.raw?.toFixed(2) || 'N/A',
      forwardPE: sd.forwardPE?.raw?.toFixed(2) || 'N/A',
      eps: ks.trailingEps?.raw?.toFixed(2) || 'N/A',
      revenue: fd.totalRevenue?.fmt || 'N/A',
      revenueGrowth: fd.revenueGrowth?.fmt || 'N/A',
      grossMargin: fd.grossMargins?.fmt || 'N/A',
      profitMargin: fd.profitMargins?.fmt || 'N/A',
      debtToEquity: fd.debtToEquity?.raw?.toFixed(2) || 'N/A',
      roe: fd.returnOnEquity?.fmt || 'N/A',
      freeCashFlow: fd.freeCashflow?.fmt || 'N/A',
      fiftyTwoWeekHigh: ks.fiftyTwoWeekHigh?.raw?.toFixed(2) || 'N/A',
      fiftyTwoWeekLow: ks.fiftyTwoWeekLow?.raw?.toFixed(2) || 'N/A',
      beta: ks.beta?.raw?.toFixed(2) || 'N/A',
      shortRatio: ks.shortRatio?.raw?.toFixed(2) || 'N/A',
      targetPrice: fd.targetMeanPrice?.raw?.toFixed(2) || 'N/A',
      recommendation: fd.recommendationKey || 'N/A',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Yahoo Finance - get recent news
app.get('/api/news/:ticker', async (req, res) => {
  const { ticker } = req.params;
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=5`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await response.json();
    const news = data?.news?.slice(0, 5).map(n => ({
      title: n.title,
      publisher: n.publisher,
      link: n.link,
      time: new Date(n.providerPublishTime * 1000).toLocaleDateString(),
    })) || [];
    res.json({ news });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Gemini AI analysis
app.post('/api/analyze', async (req, res) => {
  const { ticker, quote, financials, news } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured' });

  const newsText = news?.map(n => `- ${n.title} (${n.publisher}, ${n.time})`).join('\n') || 'No recent news';

  const prompt = `You are Blueprint — a sharp, no-fluff financial analyst. Analyze ${ticker} using this real data:

PRICE: $${quote?.price} (${quote?.changePct > 0 ? '+' : ''}${quote?.changePct}% today)
52-WEEK: $${financials?.fiftyTwoWeekLow} - $${financials?.fiftyTwoWeekHigh}
MARKET CAP: ${quote?.marketCap ? '$' + (quote.marketCap / 1e9).toFixed(1) + 'B' : 'N/A'}
PE RATIO: ${financials?.peRatio} | FORWARD PE: ${financials?.forwardPE}
REVENUE: ${financials?.revenue} | GROWTH: ${financials?.revenueGrowth}
GROSS MARGIN: ${financials?.grossMargin} | PROFIT MARGIN: ${financials?.profitMargin}
FREE CASH FLOW: ${financials?.freeCashFlow}
DEBT/EQUITY: ${financials?.debtToEquity} | ROE: ${financials?.roe}
BETA: ${financials?.beta} | SHORT RATIO: ${financials?.shortRatio}
ANALYST TARGET: $${financials?.targetPrice} | RECOMMENDATION: ${financials?.recommendation}
SECTOR: ${financials?.sector} | INDUSTRY: ${financials?.industry}

RECENT NEWS:
${newsText}

Give a sharp 4-part analysis:

1. BUSINESS MODEL — How does this company actually make money? Plain English, 2-3 sentences.

2. MOAT — What gives them an unfair advantage competitors can't easily copy? Be specific.

3. CATALYSTS — What could make this stock move significantly in the next 6-12 months? Specific upcoming events, products, or regulatory changes.

4. RISKS — 3 real risks. Not generic market risk. Company-specific threats that could hurt this investment.

5. VERDICT — One sentence. Bull or bear and why. Be direct.

Keep it sharp and real. No hedging. No fluff. Talk like someone who actually knows money.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        })
      }
    );
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'No response from Gemini' });
    res.json({ analysis: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Blueprint running on port ${PORT}`));
