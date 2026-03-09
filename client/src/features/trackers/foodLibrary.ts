export interface FoodEntry {
  name: string;
  kcalPer100g: number;
  category: string;
}

export const FOOD_LIBRARY: FoodEntry[] = [
  // Proteins
  { name: 'Chicken Breast (cooked)', kcalPer100g: 165, category: 'Protein' },
  { name: 'Chicken Thigh (cooked)', kcalPer100g: 209, category: 'Protein' },
  { name: 'Beef Mince (lean)', kcalPer100g: 215, category: 'Protein' },
  { name: 'Salmon (cooked)', kcalPer100g: 208, category: 'Protein' },
  { name: 'Tuna (canned in water)', kcalPer100g: 116, category: 'Protein' },
  { name: 'Eggs (whole)', kcalPer100g: 155, category: 'Protein' },
  { name: 'Egg Whites', kcalPer100g: 52, category: 'Protein' },
  { name: 'Greek Yogurt (0%)', kcalPer100g: 59, category: 'Protein' },
  { name: 'Cottage Cheese', kcalPer100g: 98, category: 'Protein' },
  { name: 'Whey Protein Powder', kcalPer100g: 370, category: 'Protein' },
  { name: 'Tofu', kcalPer100g: 76, category: 'Protein' },
  { name: 'Lentils (cooked)', kcalPer100g: 116, category: 'Protein' },
  // Carbs
  { name: 'White Rice (cooked)', kcalPer100g: 130, category: 'Carbs' },
  { name: 'Brown Rice (cooked)', kcalPer100g: 123, category: 'Carbs' },
  { name: 'Oats (dry)', kcalPer100g: 389, category: 'Carbs' },
  { name: 'White Bread', kcalPer100g: 265, category: 'Carbs' },
  { name: 'Whole Wheat Bread', kcalPer100g: 247, category: 'Carbs' },
  { name: 'Pasta (cooked)', kcalPer100g: 157, category: 'Carbs' },
  { name: 'Sweet Potato (cooked)', kcalPer100g: 90, category: 'Carbs' },
  { name: 'White Potato (boiled)', kcalPer100g: 87, category: 'Carbs' },
  { name: 'Banana', kcalPer100g: 89, category: 'Carbs' },
  { name: 'Apple', kcalPer100g: 52, category: 'Carbs' },
  { name: 'Orange', kcalPer100g: 47, category: 'Carbs' },
  { name: 'Blueberries', kcalPer100g: 57, category: 'Carbs' },
  { name: 'Strawberries', kcalPer100g: 32, category: 'Carbs' },
  { name: 'Grapes', kcalPer100g: 69, category: 'Carbs' },
  // Fats
  { name: 'Avocado', kcalPer100g: 160, category: 'Fats' },
  { name: 'Olive Oil', kcalPer100g: 884, category: 'Fats' },
  { name: 'Almonds', kcalPer100g: 579, category: 'Fats' },
  { name: 'Peanut Butter', kcalPer100g: 588, category: 'Fats' },
  { name: 'Walnuts', kcalPer100g: 654, category: 'Fats' },
  { name: 'Cheddar Cheese', kcalPer100g: 402, category: 'Fats' },
  { name: 'Mozzarella', kcalPer100g: 280, category: 'Fats' },
  { name: 'Butter', kcalPer100g: 717, category: 'Fats' },
  // Vegetables
  { name: 'Broccoli', kcalPer100g: 34, category: 'Vegetables' },
  { name: 'Spinach', kcalPer100g: 23, category: 'Vegetables' },
  { name: 'Lettuce (Romaine)', kcalPer100g: 17, category: 'Vegetables' },
  { name: 'Tomato', kcalPer100g: 18, category: 'Vegetables' },
  { name: 'Cucumber', kcalPer100g: 16, category: 'Vegetables' },
  { name: 'Bell Pepper', kcalPer100g: 31, category: 'Vegetables' },
  { name: 'Carrot', kcalPer100g: 41, category: 'Vegetables' },
  { name: 'Onion', kcalPer100g: 40, category: 'Vegetables' },
  { name: 'Mushrooms', kcalPer100g: 22, category: 'Vegetables' },
  { name: 'Zucchini', kcalPer100g: 17, category: 'Vegetables' },
  // Dairy / Drinks
  { name: 'Whole Milk', kcalPer100g: 61, category: 'Dairy' },
  { name: 'Skim Milk', kcalPer100g: 34, category: 'Dairy' },
  { name: 'Oat Milk', kcalPer100g: 47, category: 'Dairy' },
  { name: 'Orange Juice', kcalPer100g: 45, category: 'Drinks' },
  // Fast Food
  { name: 'Pizza (Margherita slice)', kcalPer100g: 266, category: 'Fast Food' },
  { name: 'Burger (beef patty)', kcalPer100g: 295, category: 'Fast Food' },
  { name: 'French Fries', kcalPer100g: 312, category: 'Fast Food' },
];

export function searchFoods(query: string): FoodEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return FOOD_LIBRARY.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
}

/** Fetch from Open Food Facts — returns kcal/100g results or [] on failure */
export async function fetchCaloriesFromOFF(query: string): Promise<{ name: string; kcalPer100g: number }[]> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,nutriments`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.products ?? [])
      .filter((p: any) => p.product_name && p.nutriments?.['energy-kcal_100g'])
      .map((p: any) => ({
        name: p.product_name,
        kcalPer100g: Math.round(p.nutriments['energy-kcal_100g']),
      }))
      .slice(0, 5);
  } catch {
    return [];
  }
}
