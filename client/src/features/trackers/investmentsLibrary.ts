export interface AssetEntry { ticker: string; name: string; type: 'Stock' | 'ETF' | 'Crypto' | 'Index' }

export const ASSET_LIBRARY: AssetEntry[] = [
  // US Stocks
  { ticker: 'AAPL',  name: 'Apple',            type: 'Stock' },
  { ticker: 'MSFT',  name: 'Microsoft',         type: 'Stock' },
  { ticker: 'GOOGL', name: 'Alphabet (Google)', type: 'Stock' },
  { ticker: 'AMZN',  name: 'Amazon',            type: 'Stock' },
  { ticker: 'META',  name: 'Meta',              type: 'Stock' },
  { ticker: 'TSLA',  name: 'Tesla',             type: 'Stock' },
  { ticker: 'NVDA',  name: 'Nvidia',            type: 'Stock' },
  { ticker: 'NFLX',  name: 'Netflix',           type: 'Stock' },
  { ticker: 'JPM',   name: 'JP Morgan',         type: 'Stock' },
  { ticker: 'V',     name: 'Visa',              type: 'Stock' },
  { ticker: 'JNJ',   name: 'Johnson & Johnson', type: 'Stock' },
  { ticker: 'WMT',   name: 'Walmart',           type: 'Stock' },
  { ticker: 'DIS',   name: 'Disney',            type: 'Stock' },
  { ticker: 'PYPL',  name: 'PayPal',            type: 'Stock' },
  { ticker: 'UBER',  name: 'Uber',              type: 'Stock' },
  { ticker: 'SPOT',  name: 'Spotify',           type: 'Stock' },
  { ticker: 'AMD',   name: 'AMD',               type: 'Stock' },
  { ticker: 'CRM',   name: 'Salesforce',        type: 'Stock' },
  // ETFs
  { ticker: 'SPY',   name: 'S&P 500 ETF',       type: 'ETF' },
  { ticker: 'QQQ',   name: 'Nasdaq-100 ETF',    type: 'ETF' },
  { ticker: 'VTI',   name: 'Total Market ETF',  type: 'ETF' },
  { ticker: 'VWRA',  name: 'Vanguard All World', type: 'ETF' },
  { ticker: 'IWDA',  name: 'iShares World ETF', type: 'ETF' },
  { ticker: 'CSPX',  name: 'iShares S&P 500',   type: 'ETF' },
  { ticker: 'VNQ',   name: 'Real Estate ETF',   type: 'ETF' },
  { ticker: 'GLD',   name: 'Gold ETF',          type: 'ETF' },
  // Crypto
  { ticker: 'BTC',   name: 'Bitcoin',           type: 'Crypto' },
  { ticker: 'ETH',   name: 'Ethereum',          type: 'Crypto' },
  { ticker: 'SOL',   name: 'Solana',            type: 'Crypto' },
  { ticker: 'BNB',   name: 'Binance Coin',      type: 'Crypto' },
  { ticker: 'XRP',   name: 'Ripple',            type: 'Crypto' },
  { ticker: 'USDC',  name: 'USD Coin (stable)', type: 'Crypto' },
  // Index / Bonds
  { ticker: 'BNDW',  name: 'Global Bond ETF',   type: 'Index' },
  { ticker: 'AGG',   name: 'US Bond Aggregate', type: 'Index' },
];

export function searchAssets(query: string): AssetEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return ASSET_LIBRARY.filter(
    a => a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  ).slice(0, 8);
}
