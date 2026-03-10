# Smart Trackers + Rich Widgets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add smart autocomplete/lookup trackers for every domain, enrich all dashboard widgets with meaningful data, and add a replacement-goal flow after peer verification.

**Architecture:** New `*Library.ts` files under `client/src/features/trackers/` follow the established pattern (curated array + search fn + optional async API fn). Widget enrichments are contained to their own files. Replacement goal flow lives in ChatRoom.tsx + a new GoalReplaceDialog component.

**Tech Stack:** React + TypeScript + MUI v7, Supabase anon client (direct reads), Open Library API (free, no key), existing Express backend unchanged except for checkin endpoint accepting mood/win fields.

---

## PART A — Smart Tracker Libraries

### Task 1: Expenses Tracker (category + merchant autocomplete)

**Files:**
- Create: `client/src/features/trackers/expensesLibrary.ts`
- Modify: `client/src/features/trackers/trackerTypes.ts`
- Modify: `client/src/features/trackers/TrackerWidget.tsx`
- Modify: `client/src/features/trackers/TrackerSection.tsx`

**Step 1: Create `expensesLibrary.ts`**

```typescript
export interface ExpenseCategory { name: string; emoji: string; group: string }
export interface MerchantEntry   { name: string; category: string }

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  // Food & Drink
  { name: 'Groceries',       emoji: '🛒', group: 'Food & Drink' },
  { name: 'Restaurants',     emoji: '🍽️', group: 'Food & Drink' },
  { name: 'Coffee / Cafés',  emoji: '☕', group: 'Food & Drink' },
  { name: 'Takeaway',        emoji: '🥡', group: 'Food & Drink' },
  { name: 'Alcohol / Bars',  emoji: '🍺', group: 'Food & Drink' },
  // Transport
  { name: 'Fuel',            emoji: '⛽', group: 'Transport' },
  { name: 'Public Transport',emoji: '🚇', group: 'Transport' },
  { name: 'Taxi / Uber',     emoji: '🚕', group: 'Transport' },
  { name: 'Car Insurance',   emoji: '🚗', group: 'Transport' },
  { name: 'Parking',         emoji: '🅿️', group: 'Transport' },
  { name: 'Flights',         emoji: '✈️', group: 'Transport' },
  // Housing
  { name: 'Rent / Mortgage', emoji: '🏠', group: 'Housing' },
  { name: 'Utilities',       emoji: '💡', group: 'Housing' },
  { name: 'Internet',        emoji: '📶', group: 'Housing' },
  { name: 'Home Insurance',  emoji: '🏡', group: 'Housing' },
  { name: 'Repairs',         emoji: '🔧', group: 'Housing' },
  // Health
  { name: 'Gym',             emoji: '🏋️', group: 'Health' },
  { name: 'Doctor',          emoji: '🩺', group: 'Health' },
  { name: 'Pharmacy',        emoji: '💊', group: 'Health' },
  { name: 'Health Insurance',emoji: '🏥', group: 'Health' },
  // Entertainment
  { name: 'Streaming',       emoji: '📺', group: 'Entertainment' },
  { name: 'Cinema',          emoji: '🎬', group: 'Entertainment' },
  { name: 'Events / Concerts',emoji: '🎫', group: 'Entertainment' },
  { name: 'Games',           emoji: '🎮', group: 'Entertainment' },
  { name: 'Books',           emoji: '📚', group: 'Entertainment' },
  // Shopping
  { name: 'Clothing',        emoji: '👕', group: 'Shopping' },
  { name: 'Electronics',     emoji: '💻', group: 'Shopping' },
  { name: 'Furniture',       emoji: '🛋️', group: 'Shopping' },
  { name: 'Personal Care',   emoji: '🧴', group: 'Shopping' },
  // Finance
  { name: 'Savings',         emoji: '🏦', group: 'Finance' },
  { name: 'Investment',      emoji: '📈', group: 'Finance' },
  { name: 'Loan Repayment',  emoji: '💳', group: 'Finance' },
  { name: 'Subscriptions',   emoji: '🔄', group: 'Finance' },
  // Income
  { name: 'Salary',          emoji: '💼', group: 'Income' },
  { name: 'Freelance',       emoji: '🧑‍💻', group: 'Income' },
  { name: 'Side Project',    emoji: '🚀', group: 'Income' },
  { name: 'Dividends',       emoji: '📊', group: 'Income' },
  { name: 'Gift / Bonus',    emoji: '🎁', group: 'Income' },
  // Other
  { name: 'Education',       emoji: '🎓', group: 'Other' },
  { name: 'Gifts',           emoji: '🎀', group: 'Other' },
  { name: 'Travel',          emoji: '🌍', group: 'Other' },
  { name: 'Charity',         emoji: '❤️', group: 'Other' },
  { name: 'Miscellaneous',   emoji: '📦', group: 'Other' },
];

export const MERCHANT_LIBRARY: MerchantEntry[] = [
  // Supermarkets
  { name: 'Lidl',          category: 'Groceries' },
  { name: 'Aldi',          category: 'Groceries' },
  { name: 'Tesco',         category: 'Groceries' },
  { name: 'Carrefour',     category: 'Groceries' },
  { name: 'Esselunga',     category: 'Groceries' },
  { name: 'Sainsbury\'s',  category: 'Groceries' },
  { name: 'Whole Foods',   category: 'Groceries' },
  { name: 'Waitrose',      category: 'Groceries' },
  { name: 'Conad',         category: 'Groceries' },
  { name: 'Coop',          category: 'Groceries' },
  // Restaurants / Delivery
  { name: 'McDonald\'s',   category: 'Restaurants' },
  { name: 'Burger King',   category: 'Restaurants' },
  { name: 'KFC',           category: 'Restaurants' },
  { name: 'Domino\'s',     category: 'Takeaway' },
  { name: 'Just Eat',      category: 'Takeaway' },
  { name: 'Deliveroo',     category: 'Takeaway' },
  { name: 'Uber Eats',     category: 'Takeaway' },
  { name: 'Glovo',         category: 'Takeaway' },
  // Coffee
  { name: 'Starbucks',     category: 'Coffee / Cafés' },
  { name: 'Costa Coffee',  category: 'Coffee / Cafés' },
  { name: 'Nero',          category: 'Coffee / Cafés' },
  // Transport
  { name: 'Uber',          category: 'Taxi / Uber' },
  { name: 'Bolt',          category: 'Taxi / Uber' },
  { name: 'Ryanair',       category: 'Flights' },
  { name: 'EasyJet',       category: 'Flights' },
  { name: 'Trenitalia',    category: 'Public Transport' },
  { name: 'Flixbus',       category: 'Public Transport' },
  // Health / Fitness
  { name: 'Gym membership',category: 'Gym' },
  { name: 'PureGym',       category: 'Gym' },
  { name: 'Planet Fitness',category: 'Gym' },
  { name: 'Pharmacy',      category: 'Pharmacy' },
  // Entertainment / Streaming
  { name: 'Netflix',       category: 'Streaming' },
  { name: 'Spotify',       category: 'Streaming' },
  { name: 'Apple Music',   category: 'Streaming' },
  { name: 'Disney+',       category: 'Streaming' },
  { name: 'YouTube Premium',category: 'Streaming' },
  { name: 'Amazon Prime',  category: 'Streaming' },
  // Shopping
  { name: 'Amazon',        category: 'Shopping' },
  { name: 'Zara',          category: 'Clothing' },
  { name: 'H&M',           category: 'Clothing' },
  { name: 'IKEA',          category: 'Furniture' },
  { name: 'Apple Store',   category: 'Electronics' },
  { name: 'MediaWorld',    category: 'Electronics' },
  // Utilities / Finance
  { name: 'Electric bill', category: 'Utilities' },
  { name: 'Gas bill',      category: 'Utilities' },
  { name: 'Water bill',    category: 'Utilities' },
  { name: 'PayPal',        category: 'Finance' },
  { name: 'Revolut',       category: 'Finance' },
];

export function searchCategories(q: string): ExpenseCategory[] {
  if (!q.trim()) return EXPENSE_CATEGORIES.slice(0, 8);
  const lq = q.toLowerCase();
  return EXPENSE_CATEGORIES.filter(c => c.name.toLowerCase().includes(lq) || c.group.toLowerCase().includes(lq)).slice(0, 8);
}

export function searchMerchants(q: string): MerchantEntry[] {
  if (!q.trim()) return [];
  const lq = q.toLowerCase();
  return MERCHANT_LIBRARY.filter(m => m.name.toLowerCase().includes(lq)).slice(0, 8);
}
```

**Step 2: Add `expenses` tracker type to `trackerTypes.ts`** (insert after `budget`, replacing it as the primary finance tracker — keep `budget` for backward compatibility but add `expenses` as a richer alternative):

```typescript
{
  id: 'expenses',
  label: 'Expenses Tracker',
  icon: '💸',
  description: 'Track income and expenses by category with merchant lookup',
  color: '#F59E0B',
  bg: 'rgba(245,158,11,0.08)',
  border: 'rgba(245,158,11,0.25)',
  fields: [
    { key: 'type', label: 'Type', type: 'select', options: ['Expense', 'Income', 'Saving', 'Investment'] },
    { key: 'category', label: 'Category', type: 'text', placeholder: 'Groceries' },
    { key: 'merchant', label: 'Merchant / Description', type: 'text', placeholder: 'Lidl', optional: true },
    { key: 'amount', label: 'Amount (€)', type: 'number', placeholder: '45.00' },
    { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
  ],
  entryLabel: d => `${d.type || '?'}: ${d.category || '?'}${d.merchant ? ` @ ${d.merchant}` : ''} · €${d.amount || '?'}`,
},
```

**Step 3: Update `DOMAIN_TRACKER_MAP`** — add `'expenses'` to INVESTING domain:
```typescript
[Domain.INVESTING]: ['budget', 'expenses'],
```

**Step 4: Add autocomplete state + effects to `TrackerWidget.tsx`**

Add these imports:
```typescript
import { searchCategories, searchMerchants } from './expensesLibrary';
```

Add at component level (after existing foodSuggestions state):
```typescript
const expenseCategorySuggestions = logTracker?.type === 'expenses'
  ? searchCategories(logFields['category'] ?? '')
  : [];
const merchantSuggestions = logTracker?.type === 'expenses'
  ? searchMerchants(logFields['merchant'] ?? '')
  : [];
```

In `fields.map()`, add two new branches before the existing `food` branch:
```tsx
field.key === 'category' && logTracker?.type === 'expenses' ? (
  <Autocomplete
    key={field.key}
    freeSolo
    options={expenseCategorySuggestions}
    getOptionLabel={o => typeof o === 'string' ? o : `${o.emoji} ${o.name}`}
    groupBy={o => typeof o === 'string' ? '' : o.group}
    inputValue={logFields['category'] ?? ''}
    onInputChange={(_, v) => setLogFields(p => ({ ...p, category: v }))}
    onChange={(_, v) => {
      if (v && typeof v !== 'string') setLogFields(p => ({ ...p, category: v.name }));
    }}
    renderInput={params => <TextField {...params} label="Category *" size="small" fullWidth />}
  />
) : field.key === 'merchant' && logTracker?.type === 'expenses' ? (
  <Autocomplete
    key={field.key}
    freeSolo
    options={merchantSuggestions}
    getOptionLabel={o => typeof o === 'string' ? o : o.name}
    inputValue={logFields['merchant'] ?? ''}
    onInputChange={(_, v) => setLogFields(p => ({ ...p, merchant: v }))}
    onChange={(_, v) => {
      if (v && typeof v !== 'string') {
        setLogFields(p => ({ ...p, merchant: v.name, category: p['category'] || v.category }));
      }
    }}
    renderInput={params => <TextField {...params} label="Merchant / Description (optional)" size="small" fullWidth />}
  />
) : (
  // existing chain continues
)
```

**Step 5: Apply identical changes to `TrackerSection.tsx`**

**Step 6: TypeScript check:**
```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit 2>&1 | head -20
```

**Step 7: Commit:**
```bash
git add client/src/features/trackers/expensesLibrary.ts \
        client/src/features/trackers/trackerTypes.ts \
        client/src/features/trackers/TrackerWidget.tsx \
        client/src/features/trackers/TrackerSection.tsx
git commit -m "feat: expenses tracker with category + merchant autocomplete"
```

---

### Task 2: Investments Tracker (asset autocomplete)

**Files:**
- Create: `client/src/features/trackers/investmentsLibrary.ts`
- Modify: `client/src/features/trackers/trackerTypes.ts`
- Modify: `client/src/features/trackers/TrackerWidget.tsx`
- Modify: `client/src/features/trackers/TrackerSection.tsx`

**Step 1: Create `investmentsLibrary.ts`**

```typescript
export interface AssetEntry { ticker: string; name: string; type: 'Stock' | 'ETF' | 'Crypto' | 'Index' }

export const ASSET_LIBRARY: AssetEntry[] = [
  // US Stocks
  { ticker: 'AAPL',  name: 'Apple',           type: 'Stock' },
  { ticker: 'MSFT',  name: 'Microsoft',        type: 'Stock' },
  { ticker: 'GOOGL', name: 'Alphabet (Google)',type: 'Stock' },
  { ticker: 'AMZN',  name: 'Amazon',           type: 'Stock' },
  { ticker: 'META',  name: 'Meta',             type: 'Stock' },
  { ticker: 'TSLA',  name: 'Tesla',            type: 'Stock' },
  { ticker: 'NVDA',  name: 'Nvidia',           type: 'Stock' },
  { ticker: 'NFLX',  name: 'Netflix',          type: 'Stock' },
  { ticker: 'JPM',   name: 'JP Morgan',        type: 'Stock' },
  { ticker: 'V',     name: 'Visa',             type: 'Stock' },
  { ticker: 'JNJ',   name: 'Johnson & Johnson',type: 'Stock' },
  { ticker: 'WMT',   name: 'Walmart',          type: 'Stock' },
  { ticker: 'DIS',   name: 'Disney',           type: 'Stock' },
  { ticker: 'PYPL',  name: 'PayPal',           type: 'Stock' },
  { ticker: 'UBER',  name: 'Uber',             type: 'Stock' },
  { ticker: 'SPOT',  name: 'Spotify',          type: 'Stock' },
  { ticker: 'AMD',   name: 'AMD',              type: 'Stock' },
  { ticker: 'CRM',   name: 'Salesforce',       type: 'Stock' },
  // ETFs
  { ticker: 'SPY',   name: 'S&P 500 ETF',      type: 'ETF' },
  { ticker: 'QQQ',   name: 'Nasdaq-100 ETF',   type: 'ETF' },
  { ticker: 'VTI',   name: 'Total Market ETF', type: 'ETF' },
  { ticker: 'VWRA',  name: 'Vanguard All World',type: 'ETF' },
  { ticker: 'IWDA',  name: 'iShares World ETF',type: 'ETF' },
  { ticker: 'CSPX',  name: 'iShares S&P 500',  type: 'ETF' },
  { ticker: 'VNQ',   name: 'Real Estate ETF',  type: 'ETF' },
  { ticker: 'GLD',   name: 'Gold ETF',         type: 'ETF' },
  // Crypto
  { ticker: 'BTC',   name: 'Bitcoin',          type: 'Crypto' },
  { ticker: 'ETH',   name: 'Ethereum',         type: 'Crypto' },
  { ticker: 'SOL',   name: 'Solana',           type: 'Crypto' },
  { ticker: 'BNB',   name: 'Binance Coin',     type: 'Crypto' },
  { ticker: 'XRP',   name: 'Ripple',           type: 'Crypto' },
  { ticker: 'USDC',  name: 'USD Coin (stable)',type: 'Crypto' },
  // Index / Bonds
  { ticker: 'BNDW',  name: 'Global Bond ETF',  type: 'Index' },
  { ticker: 'AGG',   name: 'US Bond Aggregate',type: 'Index' },
];

export function searchAssets(query: string): AssetEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return ASSET_LIBRARY.filter(
    a => a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  ).slice(0, 8);
}
```

**Step 2: Add `investments` tracker type to `trackerTypes.ts`** (insert after `expenses`):

```typescript
{
  id: 'investments',
  label: 'Investment Log',
  icon: '📈',
  description: 'Log buy/sell trades and portfolio changes',
  color: '#10B981',
  bg: 'rgba(16,185,129,0.08)',
  border: 'rgba(16,185,129,0.25)',
  fields: [
    { key: 'action', label: 'Action', type: 'select', options: ['Buy', 'Sell', 'Dividend', 'Rebalance'] },
    { key: 'asset', label: 'Asset (ticker or name)', type: 'text', placeholder: 'AAPL — Apple' },
    { key: 'quantity', label: 'Quantity / Units', type: 'number', placeholder: '10' },
    { key: 'price', label: 'Price per unit (€)', type: 'number', placeholder: '180.00' },
    { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
  ],
  entryLabel: d => `${d.action || '?'}: ${d.asset || '?'} · ${d.quantity} × €${d.price}`,
},
```

**Step 3: Update `DOMAIN_TRACKER_MAP`**:
```typescript
[Domain.INVESTING]: ['budget', 'expenses', 'investments'],
```

**Step 4: Add `assetSuggestions` to both TrackerWidget.tsx and TrackerSection.tsx**

Import: `import { searchAssets } from './investmentsLibrary';`

At component level:
```typescript
const assetSuggestions = logTracker?.type === 'investments'
  ? searchAssets(logFields['asset'] ?? '')
  : [];
```

In `fields.map()`, add branch for `field.key === 'asset' && logTracker?.type === 'investments'`:
```tsx
<Autocomplete
  key={field.key}
  freeSolo
  options={assetSuggestions}
  getOptionLabel={o => typeof o === 'string' ? o : `${o.ticker} — ${o.name}`}
  groupBy={o => typeof o === 'string' ? '' : o.type}
  inputValue={logFields['asset'] ?? ''}
  onInputChange={(_, v) => setLogFields(p => ({ ...p, asset: v }))}
  onChange={(_, v) => {
    if (v && typeof v !== 'string') setLogFields(p => ({ ...p, asset: `${v.ticker} — ${v.name}` }));
  }}
  renderInput={params => <TextField {...params} label="Asset *" size="small" fullWidth />}
/>
```

**Step 5: TypeScript check + commit:**
```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit 2>&1 | head -20
git add client/src/features/trackers/investmentsLibrary.ts \
        client/src/features/trackers/trackerTypes.ts \
        client/src/features/trackers/TrackerWidget.tsx \
        client/src/features/trackers/TrackerSection.tsx
git commit -m "feat: investment log tracker with asset autocomplete"
```

---

### Task 3: Company Autocomplete for Job Applications Tracker

**Files:**
- Create: `client/src/features/trackers/companiesLibrary.ts`
- Modify: `client/src/features/trackers/TrackerWidget.tsx`
- Modify: `client/src/features/trackers/TrackerSection.tsx`

**Step 1: Create `companiesLibrary.ts`**

```typescript
export interface CompanyEntry { name: string; sector: string }

export const COMPANY_LIBRARY: CompanyEntry[] = [
  // Tech
  { name: 'Google',       sector: 'Tech' }, { name: 'Apple',        sector: 'Tech' },
  { name: 'Microsoft',    sector: 'Tech' }, { name: 'Meta',         sector: 'Tech' },
  { name: 'Amazon',       sector: 'Tech' }, { name: 'Netflix',      sector: 'Tech' },
  { name: 'Nvidia',       sector: 'Tech' }, { name: 'Salesforce',   sector: 'Tech' },
  { name: 'Stripe',       sector: 'Tech' }, { name: 'Spotify',      sector: 'Tech' },
  { name: 'Airbnb',       sector: 'Tech' }, { name: 'Uber',         sector: 'Tech' },
  { name: 'Palantir',     sector: 'Tech' }, { name: 'OpenAI',       sector: 'Tech' },
  { name: 'Anthropic',    sector: 'Tech' }, { name: 'DeepMind',     sector: 'Tech' },
  { name: 'Notion',       sector: 'Tech' }, { name: 'Figma',        sector: 'Tech' },
  { name: 'Canva',        sector: 'Tech' }, { name: 'Twilio',       sector: 'Tech' },
  { name: 'Cloudflare',   sector: 'Tech' }, { name: 'Vercel',       sector: 'Tech' },
  { name: 'HashiCorp',    sector: 'Tech' }, { name: 'Databricks',   sector: 'Tech' },
  // Finance
  { name: 'Goldman Sachs',sector: 'Finance' }, { name: 'JP Morgan',   sector: 'Finance' },
  { name: 'BlackRock',    sector: 'Finance' }, { name: 'Morgan Stanley',sector: 'Finance' },
  { name: 'Revolut',      sector: 'Finance' }, { name: 'N26',          sector: 'Finance' },
  { name: 'Wise',         sector: 'Finance' }, { name: 'Klarna',       sector: 'Finance' },
  // Consulting
  { name: 'McKinsey',     sector: 'Consulting' }, { name: 'BCG',        sector: 'Consulting' },
  { name: 'Bain',         sector: 'Consulting' }, { name: 'Deloitte',   sector: 'Consulting' },
  { name: 'Accenture',    sector: 'Consulting' }, { name: 'PwC',        sector: 'Consulting' },
  // Healthcare
  { name: 'Pfizer',       sector: 'Healthcare' }, { name: 'Novartis',   sector: 'Healthcare' },
  { name: 'Johnson & Johnson', sector: 'Healthcare' }, { name: 'Roche', sector: 'Healthcare' },
  // Media / Creative
  { name: 'BBC',          sector: 'Media' }, { name: 'Guardian',    sector: 'Media' },
  { name: 'Disney',       sector: 'Media' }, { name: 'Warner Bros', sector: 'Media' },
  // Other
  { name: 'Tesla',        sector: 'Automotive' }, { name: 'BMW',        sector: 'Automotive' },
  { name: 'Ferrari',      sector: 'Automotive' }, { name: 'IKEA',       sector: 'Retail' },
  { name: 'L\'Oréal',     sector: 'FMCG' },       { name: 'Unilever',   sector: 'FMCG' },
];

export function searchCompanies(query: string): CompanyEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return COMPANY_LIBRARY.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
}
```

**Step 2: Add `companySuggestions` to TrackerWidget.tsx and TrackerSection.tsx**

Import: `import { searchCompanies } from './companiesLibrary';`

At component level:
```typescript
const companySuggestions = logTracker?.type === 'job-apps'
  ? searchCompanies(logFields['company'] ?? '')
  : [];
```

In `fields.map()`, add branch for `field.key === 'company' && logTracker?.type === 'job-apps'`:
```tsx
<Autocomplete
  key={field.key}
  freeSolo
  options={companySuggestions}
  getOptionLabel={o => typeof o === 'string' ? o : o.name}
  groupBy={o => typeof o === 'string' ? '' : o.sector}
  inputValue={logFields['company'] ?? ''}
  onInputChange={(_, v) => setLogFields(p => ({ ...p, company: v }))}
  onChange={(_, v) => {
    if (v && typeof v !== 'string') setLogFields(p => ({ ...p, company: v.name }));
  }}
  renderInput={params => <TextField {...params} label="Company *" size="small" fullWidth />}
/>
```

**Step 3: TypeScript check + commit:**
```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit 2>&1 | head -20
git add client/src/features/trackers/companiesLibrary.ts \
        client/src/features/trackers/TrackerWidget.tsx \
        client/src/features/trackers/TrackerSection.tsx
git commit -m "feat: company autocomplete for job applications tracker"
```

---

### Task 4: Books / Reading Tracker (Open Library API)

**Files:**
- Create: `client/src/features/trackers/booksLibrary.ts`
- Modify: `client/src/features/trackers/trackerTypes.ts`
- Modify: `client/src/features/trackers/TrackerWidget.tsx`
- Modify: `client/src/features/trackers/TrackerSection.tsx`

**Step 1: Create `booksLibrary.ts`**

```typescript
export interface BookResult {
  title: string;
  author: string;
  totalPages: number | null;
}

export async function searchBooks(query: string): Promise<BookResult[]> {
  if (!query.trim()) return [];
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,number_of_pages_median&limit=6`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.docs ?? [])
      .filter((d: any) => d.title)
      .map((d: any) => ({
        title: d.title,
        author: Array.isArray(d.author_name) ? d.author_name[0] : (d.author_name ?? 'Unknown'),
        totalPages: d.number_of_pages_median ?? null,
      }))
      .slice(0, 6);
  } catch {
    return [];
  }
}
```

**Step 2: Add `books` tracker type to `trackerTypes.ts`** (after `study`):

```typescript
{
  id: 'books',
  label: 'Reading Tracker',
  icon: '📖',
  description: 'Track books you\'re reading with page progress',
  color: '#6366F1',
  bg: 'rgba(99,102,241,0.08)',
  border: 'rgba(99,102,241,0.25)',
  fields: [
    { key: 'title', label: 'Book title', type: 'text', placeholder: 'Search a book...' },
    { key: 'author', label: 'Author', type: 'text', placeholder: 'Auto-filled', optional: true },
    { key: 'pages_read', label: 'Pages read today', type: 'number', placeholder: '30' },
    { key: 'total_pages', label: 'Total pages', type: 'number', placeholder: '300', optional: true },
    { key: 'rating', label: 'Rating (1–5)', type: 'number', placeholder: '5', optional: true },
    { key: 'notes', label: 'Notes / Highlights', type: 'text', placeholder: 'optional', optional: true },
  ],
  entryLabel: d => `"${d.title || '?'}" — ${d.pages_read}p read${d.total_pages ? ` (of ${d.total_pages})` : ''}`,
},
```

**Step 3: Update `DOMAIN_TRACKER_MAP`**:
```typescript
[Domain.ACADEMICS]:                        ['study', 'books'],
[Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: ['project', 'books', 'music'],
```

**Step 4: Add book search state + effect to TrackerWidget.tsx and TrackerSection.tsx**

Import: `import { searchBooks } from './booksLibrary';`

State at component level:
```typescript
const [bookResults, setBookResults] = React.useState<{ title: string; author: string; totalPages: number | null }[]>([]);
const [bookSearching, setBookSearching] = React.useState(false);
```

Effect at component level:
```typescript
React.useEffect(() => {
  const bookQuery = logTracker?.type === 'books' ? (logFields['title'] ?? '') : '';
  if (!bookQuery.trim()) { setBookResults([]); return; }
  let active = true;
  setBookSearching(true);
  searchBooks(bookQuery).then(r => { if (active) { setBookResults(r); setBookSearching(false); } });
  return () => { active = false; };
}, [logTracker?.type, logFields['title']]);
```

In `fields.map()`, add branch for `field.key === 'title' && logTracker?.type === 'books'`:
```tsx
<Autocomplete
  key={field.key}
  freeSolo
  loading={bookSearching}
  options={bookResults}
  getOptionLabel={o => typeof o === 'string' ? o : `${o.title} — ${o.author}`}
  inputValue={logFields['title'] ?? ''}
  onInputChange={(_, v) => setLogFields(p => ({ ...p, title: v }))}
  onChange={(_, v) => {
    if (v && typeof v !== 'string') {
      setLogFields(p => ({
        ...p,
        title: v.title,
        author: v.author,
        total_pages: v.totalPages ? String(v.totalPages) : p['total_pages'],
      }));
    }
  }}
  renderInput={params => <TextField {...params} label="Book title *" size="small" fullWidth />}
/>
```

**Step 5: TypeScript check + commit:**
```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit 2>&1 | head -20
git add client/src/features/trackers/booksLibrary.ts \
        client/src/features/trackers/trackerTypes.ts \
        client/src/features/trackers/TrackerWidget.tsx \
        client/src/features/trackers/TrackerSection.tsx
git commit -m "feat: books/reading tracker with Open Library API search"
```

---

### Task 5: Subject Autocomplete for Study Tracker + Music Practice Tracker

**Files:**
- Create: `client/src/features/trackers/subjectsLibrary.ts`
- Create: `client/src/features/trackers/musicLibrary.ts`
- Modify: `client/src/features/trackers/trackerTypes.ts`
- Modify: `client/src/features/trackers/TrackerWidget.tsx`
- Modify: `client/src/features/trackers/TrackerSection.tsx`

**Step 1: Create `subjectsLibrary.ts`**

```typescript
export interface SubjectEntry { name: string; category: string }

export const SUBJECT_LIBRARY: SubjectEntry[] = [
  // STEM
  { name: 'Mathematics',        category: 'STEM' }, { name: 'Calculus',         category: 'STEM' },
  { name: 'Statistics',         category: 'STEM' }, { name: 'Linear Algebra',   category: 'STEM' },
  { name: 'Physics',            category: 'STEM' }, { name: 'Chemistry',        category: 'STEM' },
  { name: 'Biology',            category: 'STEM' }, { name: 'Computer Science', category: 'STEM' },
  { name: 'Data Science',       category: 'STEM' }, { name: 'Machine Learning', category: 'STEM' },
  { name: 'Deep Learning',      category: 'STEM' }, { name: 'Algorithms',       category: 'STEM' },
  // Programming
  { name: 'Python',             category: 'Programming' }, { name: 'JavaScript',  category: 'Programming' },
  { name: 'TypeScript',         category: 'Programming' }, { name: 'Rust',         category: 'Programming' },
  { name: 'Go',                 category: 'Programming' }, { name: 'Swift',        category: 'Programming' },
  { name: 'SQL',                category: 'Programming' }, { name: 'React',        category: 'Programming' },
  // Business
  { name: 'Economics',          category: 'Business' }, { name: 'Marketing',      category: 'Business' },
  { name: 'Finance',            category: 'Business' }, { name: 'Accounting',     category: 'Business' },
  { name: 'Product Management', category: 'Business' }, { name: 'Strategy',       category: 'Business' },
  { name: 'Entrepreneurship',   category: 'Business' }, { name: 'Leadership',     category: 'Business' },
  // Languages
  { name: 'English',            category: 'Languages' }, { name: 'Spanish',        category: 'Languages' },
  { name: 'French',             category: 'Languages' }, { name: 'German',         category: 'Languages' },
  { name: 'Italian',            category: 'Languages' }, { name: 'Mandarin',       category: 'Languages' },
  { name: 'Japanese',           category: 'Languages' }, { name: 'Portuguese',     category: 'Languages' },
  { name: 'Arabic',             category: 'Languages' }, { name: 'Russian',        category: 'Languages' },
  // Humanities
  { name: 'Philosophy',         category: 'Humanities' }, { name: 'History',       category: 'Humanities' },
  { name: 'Psychology',         category: 'Humanities' }, { name: 'Sociology',     category: 'Humanities' },
  { name: 'Literature',         category: 'Humanities' }, { name: 'Writing',       category: 'Humanities' },
  // Creative
  { name: 'Graphic Design',     category: 'Creative' }, { name: 'UI/UX Design',   category: 'Creative' },
  { name: 'Photography',        category: 'Creative' }, { name: 'Video Editing',  category: 'Creative' },
  { name: 'Music Theory',       category: 'Creative' }, { name: 'Drawing',        category: 'Creative' },
];

export function searchSubjects(query: string): SubjectEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return SUBJECT_LIBRARY.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)).slice(0, 8);
}
```

**Step 2: Create `musicLibrary.ts`**

```typescript
export interface InstrumentEntry { name: string; family: string }

export const INSTRUMENT_LIBRARY: InstrumentEntry[] = [
  { name: 'Guitar (Acoustic)',  family: 'Strings' }, { name: 'Guitar (Electric)', family: 'Strings' },
  { name: 'Bass Guitar',        family: 'Strings' }, { name: 'Violin',            family: 'Strings' },
  { name: 'Cello',              family: 'Strings' }, { name: 'Ukulele',           family: 'Strings' },
  { name: 'Piano',              family: 'Keys'    }, { name: 'Keyboard',          family: 'Keys'    },
  { name: 'Synthesizer',        family: 'Keys'    }, { name: 'Organ',             family: 'Keys'    },
  { name: 'Drums',              family: 'Percussion' }, { name: 'Percussion',    family: 'Percussion' },
  { name: 'Flute',              family: 'Wind'    }, { name: 'Saxophone',         family: 'Wind'    },
  { name: 'Trumpet',            family: 'Wind'    }, { name: 'Clarinet',          family: 'Wind'    },
  { name: 'Voice / Singing',    family: 'Voice'   }, { name: 'DJ / Production',   family: 'Electronic' },
  { name: 'Music Production',   family: 'Electronic' },
];

export function searchInstruments(query: string): InstrumentEntry[] {
  if (!query.trim()) return INSTRUMENT_LIBRARY.slice(0, 6);
  const q = query.toLowerCase();
  return INSTRUMENT_LIBRARY.filter(i => i.name.toLowerCase().includes(q) || i.family.toLowerCase().includes(q)).slice(0, 8);
}
```

**Step 3: Add `music` tracker type to `trackerTypes.ts`** (after `project`):

```typescript
{
  id: 'music',
  label: 'Music Practice',
  icon: '🎵',
  description: 'Track instrument practice sessions and repertoire progress',
  color: '#A855F7',
  bg: 'rgba(168,85,247,0.08)',
  border: 'rgba(168,85,247,0.25)',
  fields: [
    { key: 'instrument', label: 'Instrument', type: 'text', placeholder: 'Guitar, Piano…' },
    { key: 'piece', label: 'Piece / Song', type: 'text', placeholder: 'Moonlight Sonata, Wonderwall…' },
    { key: 'duration_min', label: 'Duration (min)', type: 'number', placeholder: '30' },
    { key: 'focus', label: 'Focus area', type: 'select', options: ['Technique', 'Sight-reading', 'Memorisation', 'Expression', 'Repertoire', 'Improvisation', 'Theory'] },
    { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
  ],
  entryLabel: d => `${d.instrument || '?'}: "${d.piece || '?'}" · ${d.duration_min}min [${d.focus || '?'}]`,
},
```

**Step 4: Update DOMAIN_TRACKER_MAP** (already done for `books` in Task 4 — just add `music` to Culture if not done):
```typescript
[Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: ['project', 'books', 'music'],
```

**Step 5: Wire subject + instrument autocomplete in TrackerWidget.tsx and TrackerSection.tsx**

Imports:
```typescript
import { searchSubjects } from './subjectsLibrary';
import { searchInstruments } from './musicLibrary';
```

At component level:
```typescript
const subjectSuggestions = logTracker?.type === 'study'
  ? searchSubjects(logFields['subject'] ?? '')
  : [];
const instrumentSuggestions = logTracker?.type === 'music'
  ? searchInstruments(logFields['instrument'] ?? '')
  : [];
```

In `fields.map()`, add branches for `field.key === 'subject' && logTracker?.type === 'study'` and `field.key === 'instrument' && logTracker?.type === 'music'` with the same Autocomplete pattern as above.

**Step 6: TypeScript check + commit:**
```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit 2>&1 | head -20
git add client/src/features/trackers/subjectsLibrary.ts \
        client/src/features/trackers/musicLibrary.ts \
        client/src/features/trackers/trackerTypes.ts \
        client/src/features/trackers/TrackerWidget.tsx \
        client/src/features/trackers/TrackerSection.tsx
git commit -m "feat: subject autocomplete for study tracker + music practice tracker"
```

---

## PART B — Widget Enrichments

### Task 6: CheckInWidget — 7-day calendar + mood selector

**Files:**
- Modify: `client/src/features/dashboard/components/CheckInWidget.tsx`

The widget currently shows: streak number + tier chip + points + check-in button.
Add: 7-day mini calendar + 5-emoji mood picker + optional "win of the day" text.

**Step 1: Read the full file first.**

**Step 2: Add new state** (inside the component, after existing state):
```tsx
const [recentDays, setRecentDays] = useState<boolean[]>([]);  // last 7 days, true = checked in
const [mood, setMood] = useState<string | null>(null);
const [winText, setWinText] = useState('');
const [showWinInput, setShowWinInput] = useState(false);
```

**Step 3: Fetch last 7 check-in dates** — add to the existing useEffect or a new one:
```tsx
// After the existing fetchCheckinStatus logic, add:
const { data: recentCheckins } = await supabase
  .from('checkins')
  .select('created_at')
  .eq('user_id', userId)
  .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
  .order('created_at', { ascending: false });

const checkinDates = new Set((recentCheckins ?? []).map((c: any) => c.created_at.slice(0, 10)));
const last7 = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return checkinDates.has(d.toISOString().slice(0, 10));
});
setRecentDays(last7);
```

**Step 4: Pass mood + win to handleCheckIn** — update the POST body:
```tsx
const res = await axios.post(`${API_URL}/checkins`, { userId, mood, winOfTheDay: winText }, { headers });
```

**Step 5: Add JSX below the existing streak row** — add after the streak/check-in row, before closing GlassCard:
```tsx
{/* 7-day mini calendar */}
<Box sx={{ display: 'flex', gap: 0.75, mt: 2 }}>
  {['M','T','W','T','F','S','S'].map((day, i) => (
    <Box key={i} sx={{ textAlign: 'center', flex: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', display: 'block', mb: 0.5 }}>
        {day}
      </Typography>
      <Box sx={{
        width: 24, height: 24, borderRadius: '50%', mx: 'auto',
        bgcolor: recentDays[i] ? '#F97316' : 'rgba(255,255,255,0.06)',
        border: i === 6 ? '2px solid rgba(249,115,22,0.4)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {recentDays[i] && <CheckCircleIcon sx={{ fontSize: 12, color: '#fff' }} />}
      </Box>
    </Box>
  ))}
</Box>

{/* Mood selector — only show before check-in */}
{!checkedIn && (
  <Box sx={{ mt: 2 }}>
    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>How are you feeling?</Typography>
    <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
      {['😤','😐','🙂','😊','🔥'].map(emoji => (
        <Box
          key={emoji}
          onClick={() => setMood(emoji)}
          sx={{
            fontSize: '1.4rem', cursor: 'pointer', p: 0.5, borderRadius: 2,
            border: mood === emoji ? '2px solid #F97316' : '2px solid transparent',
            bgcolor: mood === emoji ? 'rgba(249,115,22,0.1)' : 'transparent',
            transition: 'all 0.15s',
            '&:hover': { bgcolor: 'rgba(249,115,22,0.08)' },
          }}
        >
          {emoji}
        </Box>
      ))}
    </Stack>
  </Box>
)}

{/* Win of the day */}
{!checkedIn && (
  <Box sx={{ mt: 1.5 }}>
    {showWinInput ? (
      <TextField
        size="small" fullWidth multiline rows={2}
        placeholder="What's your win today? (optional)"
        value={winText}
        onChange={e => setWinText(e.target.value)}
        inputProps={{ maxLength: 140 }}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.82rem' } }}
      />
    ) : (
      <Button size="small" variant="text"
        onClick={() => setShowWinInput(true)}
        sx={{ fontSize: '0.72rem', color: 'text.secondary', p: 0 }}
      >
        + Add a win for today
      </Button>
    )}
  </Box>
)}
```

**Step 6: TypeScript check + commit:**
```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit 2>&1 | head -20
git add client/src/features/dashboard/components/CheckInWidget.tsx
git commit -m "ux: check-in widget — 7-day calendar + mood selector + win of the day"
```

---

### Task 7: GoalProgressWidget — quick +10% button + deadline chip

**Files:**
- Modify: `client/src/features/dashboard/components/GoalProgressWidget.tsx`

**Step 1: Read the full file first.**

**Step 2: Add a quick +10% increment handler** alongside the existing popover-based update:
```tsx
const handleQuickIncrement = async (node: BackendNode) => {
  const newPct = Math.min(100, Math.round(node.progress * 100) + 10);
  setSaving(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await axios.patch(
      `${API_URL}/goals/${userId}/node/${node.id}/progress`,
      { progress: newPct },
      { headers: { Authorization: `Bearer ${session?.access_token}` } },
    );
    onProgressUpdate(node.id, newPct / 100);
    toast.success(`+10% → ${newPct}%`);
  } catch {
    toast.error('Failed to update');
  } finally {
    setSaving(false);
  }
};
```

**Step 3: In the node row JSX**, after the existing edit IconButton, add a +10% quick button:
```tsx
<Tooltip title="+10%">
  <IconButton
    size="small"
    onClick={() => handleQuickIncrement(node)}
    disabled={saving || pct >= 100}
    sx={{ color: color, opacity: pct >= 100 ? 0.3 : 0.7, '&:hover': { color } }}
  >
    <TrendingUpIcon sx={{ fontSize: 16 }} />
  </IconButton>
</Tooltip>
```

(Import `TrendingUpIcon` from `@mui/icons-material/TrendingUp` — check if already imported, add if not.)

**Step 4: Add saving state** to the component — read the file to find where to add it alongside existing state.

**Step 5: TypeScript check + commit:**
```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit 2>&1 | head -20
git add client/src/features/dashboard/components/GoalProgressWidget.tsx
git commit -m "ux: goal progress widget — quick +10% button"
```

---

### Task 8: AccountabilityNetworkWidget — show active goal + improved status

**Files:**
- Modify: `client/src/features/dashboard/components/AccountabilityNetworkWidget.tsx`

**Step 1: Read the full file.**

**Step 2: Fetch each friend's active goal** — after fetching profiles, batch-fetch goal trees:
```tsx
// After setFriends(sorted.slice(0, 8)), add:
const profileIds = sorted.slice(0, 8).map(p => p.id);
const { data: trees } = await supabase
  .from('goal_trees')
  .select('userId, nodes')
  .in('userId', profileIds);

const goalsByUser: Record<string, string> = {};
for (const tree of trees ?? []) {
  const nodes: any[] = Array.isArray(tree.nodes) ? tree.nodes : [];
  const active = nodes
    .filter(n => !n.parentId && (n.progress ?? 0) < 1 && n.status !== 'suspended')
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];
  if (active) goalsByUser[tree.userId] = active.name;
}
setFriendGoals(goalsByUser);
```

Add state: `const [friendGoals, setFriendGoals] = useState<Record<string, string>>({});`

**Step 3: In the friend card JSX**, add goal line below name:
```tsx
{friendGoals[friend.id] && (
  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem', display: 'block', mt: 0.25 }} noWrap>
    🎯 {friendGoals[friend.id]}
  </Typography>
)}
```

**Step 4: TypeScript check + commit:**
```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit 2>&1 | head -20
git add client/src/features/dashboard/components/AccountabilityNetworkWidget.tsx
git commit -m "ux: accountability widget — show friend's active goal"
```

---

### Task 9: BalanceWidget — domain health bars (lower threshold + always visible)

**Files:**
- Modify: `client/src/features/dashboard/components/BalanceWidget.tsx`

**Step 1: Read the full file.**

**Step 2: Change the early-return logic** — the widget currently returns `null` if streak < 14 or no neglected domains. Change it to show domain health bars for ANY user with a streak ≥ 3:

Remove the strict `if (neglectedDomains.length === 0) return null;` and `if (streak < 14)` guards. Replace with:

```tsx
// Always show for streak ≥ 3, even with no neglected domains
if (streak < 3 || nodes.length === 0) return null;
```

**Step 3: Rewrite the render** to always show domain health bars, with a balanced/warning state:

```tsx
return (
  <GlassCard sx={{ p: 2.5, mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <BalanceIcon sx={{ color: neglectedDomains.length > 0 ? '#F59E0B' : '#10B981', fontSize: 20 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {neglectedDomains.length > 0 ? 'Balance Intervention' : 'Domain Balance'}
      </Typography>
      {neglectedDomains.length === 0 && (
        <Chip label="Balanced" size="small" sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#10B981', fontWeight: 700, fontSize: '0.68rem', ml: 'auto' }} />
      )}
    </Box>

    <Stack spacing={1}>
      {Object.entries(domainProgress).map(([domain, { total, count }]) => {
        const avg = count > 0 ? total / count : 0;
        const pct = Math.round(avg * 100);
        const color = pct === 0 ? '#EF4444' : pct < 30 ? '#F59E0B' : '#10B981';
        const shortDomain = domain.split('/')[0].trim().split(' ')[0]; // e.g. "Fitness"
        return (
          <Box key={domain}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.7rem' }}>
                {shortDomain}
              </Typography>
              <Typography variant="caption" sx={{ color, fontWeight: 700, fontSize: '0.7rem' }}>{pct}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate" value={pct}
              sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 } }}
            />
          </Box>
        );
      })}
    </Stack>

    {neglectedDomains.length > 0 && (
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 600 }}>
          {neglectedDomains.map(d => d.split('/')[0].trim()).join(', ')} need attention
        </Typography>
        <Button size="small" onClick={onTakeZenDay} startIcon={<SpaIcon />}
          sx={{ fontSize: '0.7rem', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.4)', borderRadius: '8px' }}
          variant="outlined">
          Zen Day
        </Button>
      </Box>
    )}
  </GlassCard>
);
```

Add `LinearProgress` import from MUI if not already present.

**Step 5: TypeScript check + commit:**
```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit 2>&1 | head -20
git add client/src/features/dashboard/components/BalanceWidget.tsx
git commit -m "ux: balance widget — domain health bars, lower threshold to 3 days"
```

---

### Task 10: ReferralWidget — PP earned + referral timeline

**Files:**
- Modify: `client/src/features/referral/ReferralWidget.tsx`

**Step 1: Read the full file.**

**Step 2: Fetch referral timestamps** — update the existing `fetchCode` to also get timestamps:
```tsx
// The existing API endpoint returns { code, referralCount }
// Fetch referral claim dates from the backend (or Supabase directly):
const { data: claims } = await supabase
  .from('referral_claims')
  .select('created_at')
  .eq('referrer_id', userId)  // or however the table is structured — read manual_actions for schema
  .order('created_at', { ascending: false })
  .limit(3);
setRecentClaims((claims ?? []).map(c => c.created_at));
```

Add state: `const [recentClaims, setRecentClaims] = useState<string[]>([]);`

**Step 3: Add PP earned display and timeline** in the JSX — after the referral count display:
```tsx
{/* PP earned */}
{referralCount > 0 && (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
    <Typography sx={{ fontSize: '1.1rem' }}>⚡</Typography>
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 700, color: '#A78BFA' }}>{(referralCount * 100).toLocaleString()} PP earned</Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>from {referralCount} referral{referralCount !== 1 ? 's' : ''}</Typography>
    </Box>
  </Box>
)}

{/* Timeline */}
{recentClaims.length > 0 && (
  <Stack spacing={0.75} sx={{ mt: 1.5 }}>
    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Recent referrals</Typography>
    {recentClaims.map((date, i) => (
      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckCircleIcon sx={{ fontSize: 14, color: '#A78BFA' }} />
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · +100 PP
        </Typography>
      </Box>
    ))}
  </Stack>
)}
```

**Step 4: TypeScript check + commit:**
```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit 2>&1 | head -20
git add client/src/features/referral/ReferralWidget.tsx
git commit -m "ux: referral widget — PP earned display + referral timeline"
```

---

## PART C — Replacement Goal Flow

### Task 11: Post-Verification Replacement Goal Dialog

**Files:**
- Create: `client/src/features/goals/components/GoalReplaceDialog.tsx`
- Modify: `client/src/features/chat/ChatRoom.tsx`

**Step 1: Read `ChatRoom.tsx` lines 370–385** (the `handleCompletionResponse` function) — already done above.

**Step 2: Create `GoalReplaceDialog.tsx`**

This dialog appears after a goal is peer-verified (approved). It shows 3 domain-appropriate goal suggestions + a custom text option + skip.

```tsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, TextField, Chip, Stack,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import axios from 'axios';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';
import toast from 'react-hot-toast';

// Domain-specific goal suggestion templates
const DOMAIN_SUGGESTIONS: Record<string, string[]> = {
  'Fitness':            ['Run a half marathon', 'Build a 6-month strength program', 'Cut body fat to target %'],
  'Career':             ['Get promoted to next level', 'Launch a side project', 'Achieve a key certification'],
  'Academics':          ['Complete an online course', 'Read 12 books this year', 'Master a new programming language'],
  'Mental Health':      ['Meditate daily for 60 days', 'See a therapist monthly', 'Build a journaling habit'],
  'Investing / Financial Growth': ['Build 6-month emergency fund', 'Invest €X monthly', 'Reduce expenses by 20%'],
  'Culture / Hobbies / Creative Pursuits': ['Finish a creative project', 'Learn a new instrument', 'Write a short story'],
  'Friendship / Social Engagement': ['Host monthly gatherings', 'Reach out to 2 old friends', 'Join a community group'],
  'Intimacy / Romantic Exploration': ['Plan a meaningful date', 'Improve communication habits', 'Build a shared experience'],
  'Philosophical Development': ['Read a philosophy canon', 'Write a personal manifesto', 'Do a solo reflection retreat'],
  'Personal Goals': ['Complete a bucket-list item', 'Travel to a new country', 'Master a personal challenge'],
};

interface Props {
  open: boolean;
  onClose: () => void;
  completedGoalName: string;
  domain: string;
  userId: string;
  parentId?: string;  // if the completed node had a parent
}

const GoalReplaceDialog: React.FC<Props> = ({ open, onClose, completedGoalName, domain, userId, parentId }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestions = DOMAIN_SUGGESTIONS[domain] ?? ['Set a new challenge', 'Build on this momentum', 'Explore a new direction'];

  const handleConfirm = async () => {
    const goalName = selected === 'custom' ? customText.trim() : selected;
    if (!goalName) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Fetch current goal tree to add node
      const treeRes = await axios.get(`${API_URL}/goals/${userId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const nodes: any[] = treeRes.data.nodes ?? [];
      // Create a new node
      const newNode = {
        id: crypto.randomUUID(),
        name: goalName,
        domain,
        progress: 0,
        weight: 0.5,
        parentId: parentId ?? null,
        customDetails: `Replacement goal after completing: ${completedGoalName}`,
      };
      const updatedNodes = [...nodes, newNode];
      await axios.post(
        `${API_URL}/goals/${userId}`,
        { nodes: updatedNodes },
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      toast.success(`New goal added: "${goalName}"`);
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to add goal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <EmojiEventsIcon sx={{ color: '#F59E0B', fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Goal Completed! 🎉</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              "{completedGoalName}" — what's next?
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Pick a suggested next challenge or write your own:
        </Typography>

        <Stack spacing={1} sx={{ mb: 2 }}>
          {suggestions.map(s => (
            <Box
              key={s}
              onClick={() => setSelected(s)}
              sx={{
                p: 1.5, borderRadius: 2, cursor: 'pointer',
                border: selected === s ? '2px solid #A78BFA' : '1px solid rgba(255,255,255,0.08)',
                bgcolor: selected === s ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.02)',
                '&:hover': { bgcolor: 'rgba(167,139,250,0.05)' },
                transition: 'all 0.15s',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: selected === s ? 700 : 400 }}>
                {s}
              </Typography>
            </Box>
          ))}

          <Box
            onClick={() => setSelected('custom')}
            sx={{
              p: 1.5, borderRadius: 2, cursor: 'pointer',
              border: selected === 'custom' ? '2px solid #A78BFA' : '1px solid rgba(255,255,255,0.08)',
              bgcolor: selected === 'custom' ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.02)',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: selected === 'custom' ? 1 : 0 }}>
              ✏️ Write my own…
            </Typography>
            {selected === 'custom' && (
              <TextField
                fullWidth size="small" autoFocus
                placeholder="Describe your next goal"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onClick={e => e.stopPropagation()}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Skip for now</Button>
        <Button
          variant="contained"
          disabled={!selected || (selected === 'custom' && !customText.trim()) || saving}
          onClick={handleConfirm}
          sx={{ borderRadius: '10px', background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', fontWeight: 700 }}
        >
          {saving ? 'Adding…' : 'Add Goal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GoalReplaceDialog;
```

**Step 3: Modify `ChatRoom.tsx`**

Read lines 1–30 (imports) and 372–383 (handleCompletionResponse).

Add import:
```tsx
import GoalReplaceDialog from '../goals/components/GoalReplaceDialog';
```

Add state near other dialog states:
```tsx
const [replaceGoalData, setReplaceGoalData] = useState<{
  goalName: string; domain: string; parentId?: string;
} | null>(null);
```

Modify `handleCompletionResponse` to trigger the dialog after approval:
```tsx
const handleCompletionResponse = async (requestId: string, approved: boolean, goalName?: string, domain?: string, parentId?: string) => {
  if (!currentUserId) return;
  try {
    await axios.patch(`${API_URL}/completions/${requestId}/respond`, {
      verifierId: currentUserId,
      approved,
    });
    if (approved) {
      toast.success('✅ Goal verified! +50 PP awarded.');
      if (goalName && domain) {
        setReplaceGoalData({ goalName, domain, parentId });
      }
    } else {
      toast.success('❌ Verification declined.');
    }
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Failed to respond.');
  }
};
```

**Step 4: Update the Verify button call site** — find where `handleCompletionResponse(requestId, true)` is called in the JSX. Update it to pass goalName and domain from the message metadata:

Look for the completion_request card rendering (around line 530). The message should have `metadata.goalName` and `metadata.domain` (from the completion request creation). Update the call:
```tsx
onClick={() => handleCompletionResponse(
  msg.metadata?.requestId,
  true,
  msg.metadata?.goalName,
  msg.metadata?.domain,
  msg.metadata?.parentId,
)}
```

**Step 5: Add the dialog to the ChatRoom JSX** (before the closing return tag):
```tsx
{replaceGoalData && currentUserId && (
  <GoalReplaceDialog
    open={!!replaceGoalData}
    onClose={() => setReplaceGoalData(null)}
    completedGoalName={replaceGoalData.goalName}
    domain={replaceGoalData.domain}
    userId={currentUserId}
    parentId={replaceGoalData.parentId}
  />
)}
```

**Step 6: Check what metadata the completion_request message contains** — read `completionController.ts` to see if `goalName`, `domain`, `parentId` are stored in message metadata. If not, add them:

In `completionController.ts`, find the message insert. Ensure metadata includes:
```typescript
metadata: JSON.stringify({ requestId: completion.id, goalName, domain, parentId }),
```

Read the file first and only add what's missing.

**Step 7: TypeScript check + commit:**
```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit 2>&1 | head -20
cd /home/gio/Praxis/praxis_webapp && npx tsc --noEmit 2>&1 | head -20
git add client/src/features/goals/components/GoalReplaceDialog.tsx \
        client/src/features/chat/ChatRoom.tsx \
        src/controllers/completionController.ts
git commit -m "feat: replacement goal dialog after peer verification"
```

---

## Final Verification

```bash
# Backend
cd /home/gio/Praxis/praxis_webapp && npx tsc --noEmit
# Frontend
cd client && npx tsc --noEmit
```

Smoke tests:
1. Expenses tracker → type "food" in category → suggestions appear → select "Groceries" → type "lid" in merchant → "Lidl" appears
2. Investments tracker → type "btc" in asset → "Bitcoin" appears
3. Job-apps tracker → type "google" in company → "Google (Tech)" appears grouped by sector
4. Books tracker → type "harry" → Open Library results appear with page counts
5. Study tracker → type "python" → "Python (Programming)" appears
6. Music tracker → type "guitar" → instrument suggestions grouped by family
7. CheckInWidget → 7 day calendar renders, mood emojis clickable
8. GoalProgressWidget → +10% button visible, clicking updates progress
9. AccountabilityNetworkWidget → friend's active goal shows under their name
10. BalanceWidget → shows for streak ≥ 3 with domain bars
11. ChatRoom → verify a goal → GoalReplaceDialog appears with domain suggestions
