# Blueprint Finance Terminal

Personal finance terminal built by Near Inc. Real market data + AI-powered stock analysis.

## What it does
- Live stock prices and financials from Yahoo Finance
- AI analysis — business model, moat, catalysts, risks, verdict
- Recent news for any ticker
- Analyst consensus and price targets

## Stack
- Node.js + Express backend
- Yahoo Finance (free, no API key needed)
- Google Gemini AI for analysis
- Vanilla HTML/CSS/JS frontend

## Deploy on Render
1. Connect this repo to Render as a Web Service
2. Build command: `npm install`
3. Start command: `node server.js`
4. Add environment variable: `GEMINI_API_KEY=your_key_here`

## Local dev
```bash
npm install
GEMINI_API_KEY=your_key node server.js
```

Built by Caleb Gardner — Near Inc.
