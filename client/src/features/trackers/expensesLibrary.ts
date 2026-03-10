export interface ExpenseCategory { name: string; emoji: string; group: string }
export interface MerchantEntry   { name: string; category: string }

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  // Food & Drink
  { name: 'Groceries',        emoji: '🛒', group: 'Food & Drink' },
  { name: 'Restaurants',      emoji: '🍽️', group: 'Food & Drink' },
  { name: 'Coffee / Cafés',   emoji: '☕', group: 'Food & Drink' },
  { name: 'Takeaway',         emoji: '🥡', group: 'Food & Drink' },
  { name: 'Alcohol / Bars',   emoji: '🍺', group: 'Food & Drink' },
  // Transport
  { name: 'Fuel',             emoji: '⛽', group: 'Transport' },
  { name: 'Public Transport', emoji: '🚇', group: 'Transport' },
  { name: 'Taxi / Uber',      emoji: '🚕', group: 'Transport' },
  { name: 'Car Insurance',    emoji: '🚗', group: 'Transport' },
  { name: 'Parking',          emoji: '🅿️', group: 'Transport' },
  { name: 'Flights',          emoji: '✈️', group: 'Transport' },
  // Housing
  { name: 'Rent / Mortgage',  emoji: '🏠', group: 'Housing' },
  { name: 'Utilities',        emoji: '💡', group: 'Housing' },
  { name: 'Internet',         emoji: '📶', group: 'Housing' },
  { name: 'Home Insurance',   emoji: '🏡', group: 'Housing' },
  { name: 'Repairs',          emoji: '🔧', group: 'Housing' },
  // Health
  { name: 'Gym',              emoji: '🏋️', group: 'Health' },
  { name: 'Doctor',           emoji: '🩺', group: 'Health' },
  { name: 'Pharmacy',         emoji: '💊', group: 'Health' },
  { name: 'Health Insurance', emoji: '🏥', group: 'Health' },
  // Entertainment
  { name: 'Streaming',        emoji: '📺', group: 'Entertainment' },
  { name: 'Cinema',           emoji: '🎬', group: 'Entertainment' },
  { name: 'Events / Concerts',emoji: '🎫', group: 'Entertainment' },
  { name: 'Games',            emoji: '🎮', group: 'Entertainment' },
  { name: 'Books',            emoji: '📚', group: 'Entertainment' },
  // Shopping
  { name: 'Clothing',         emoji: '👕', group: 'Shopping' },
  { name: 'Electronics',      emoji: '💻', group: 'Shopping' },
  { name: 'Furniture',        emoji: '🛋️', group: 'Shopping' },
  { name: 'Personal Care',    emoji: '🧴', group: 'Shopping' },
  // Finance
  { name: 'Savings',          emoji: '🏦', group: 'Finance' },
  { name: 'Investment',       emoji: '📈', group: 'Finance' },
  { name: 'Loan Repayment',   emoji: '💳', group: 'Finance' },
  { name: 'Subscriptions',    emoji: '🔄', group: 'Finance' },
  // Income
  { name: 'Salary',           emoji: '💼', group: 'Income' },
  { name: 'Freelance',        emoji: '🧑‍💻', group: 'Income' },
  { name: 'Side Project',     emoji: '🚀', group: 'Income' },
  { name: 'Dividends',        emoji: '📊', group: 'Income' },
  { name: 'Gift / Bonus',     emoji: '🎁', group: 'Income' },
  // Other
  { name: 'Education',        emoji: '🎓', group: 'Other' },
  { name: 'Gifts',            emoji: '🎀', group: 'Other' },
  { name: 'Travel',           emoji: '🌍', group: 'Other' },
  { name: 'Charity',          emoji: '❤️', group: 'Other' },
  { name: 'Miscellaneous',    emoji: '📦', group: 'Other' },
];

export const MERCHANT_LIBRARY: MerchantEntry[] = [
  { name: 'Lidl',           category: 'Groceries' },
  { name: 'Aldi',           category: 'Groceries' },
  { name: 'Tesco',          category: 'Groceries' },
  { name: 'Carrefour',      category: 'Groceries' },
  { name: 'Esselunga',      category: 'Groceries' },
  { name: "Sainsbury's",    category: 'Groceries' },
  { name: 'Whole Foods',    category: 'Groceries' },
  { name: 'Waitrose',       category: 'Groceries' },
  { name: 'Conad',          category: 'Groceries' },
  { name: 'Coop',           category: 'Groceries' },
  { name: "McDonald's",     category: 'Restaurants' },
  { name: 'Burger King',    category: 'Restaurants' },
  { name: 'KFC',            category: 'Restaurants' },
  { name: "Domino's",       category: 'Takeaway' },
  { name: 'Just Eat',       category: 'Takeaway' },
  { name: 'Deliveroo',      category: 'Takeaway' },
  { name: 'Uber Eats',      category: 'Takeaway' },
  { name: 'Glovo',          category: 'Takeaway' },
  { name: 'Starbucks',      category: 'Coffee / Cafés' },
  { name: 'Costa Coffee',   category: 'Coffee / Cafés' },
  { name: 'Caffè Nero',     category: 'Coffee / Cafés' },
  { name: 'Uber',           category: 'Taxi / Uber' },
  { name: 'Bolt',           category: 'Taxi / Uber' },
  { name: 'Ryanair',        category: 'Flights' },
  { name: 'EasyJet',        category: 'Flights' },
  { name: 'Trenitalia',     category: 'Public Transport' },
  { name: 'Flixbus',        category: 'Public Transport' },
  { name: 'PureGym',        category: 'Gym' },
  { name: 'Planet Fitness', category: 'Gym' },
  { name: 'Netflix',        category: 'Streaming' },
  { name: 'Spotify',        category: 'Streaming' },
  { name: 'Apple Music',    category: 'Streaming' },
  { name: 'Disney+',        category: 'Streaming' },
  { name: 'YouTube Premium',category: 'Streaming' },
  { name: 'Amazon Prime',   category: 'Streaming' },
  { name: 'Amazon',         category: 'Electronics' },
  { name: 'Zara',           category: 'Clothing' },
  { name: 'H&M',            category: 'Clothing' },
  { name: 'IKEA',           category: 'Furniture' },
  { name: 'Apple Store',    category: 'Electronics' },
  { name: 'Electric bill',  category: 'Utilities' },
  { name: 'Gas bill',       category: 'Utilities' },
  { name: 'Water bill',     category: 'Utilities' },
  { name: 'PayPal',         category: 'Loan Repayment' },
  { name: 'Revolut',        category: 'Subscriptions' },
];

export function searchCategories(query: string): ExpenseCategory[] {
  if (!query.trim()) return EXPENSE_CATEGORIES.slice(0, 8);
  const q = query.toLowerCase();
  return EXPENSE_CATEGORIES.filter(
    c => c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
  ).slice(0, 8);
}

export function searchMerchants(query: string): MerchantEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return MERCHANT_LIBRARY.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8);
}
