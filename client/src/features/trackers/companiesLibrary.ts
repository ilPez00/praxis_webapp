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
  { name: "L'Oréal",      sector: 'FMCG' },       { name: 'Unilever',   sector: 'FMCG' },
];

export function searchCompanies(query: string): CompanyEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return COMPANY_LIBRARY.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
}
