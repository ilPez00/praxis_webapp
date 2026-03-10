# Tracker Enhancements + Goal Tree Editing + Marketplace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add step counter + calorie lookup to trackers, free goal-tree editing for admin user gio, and add goal-slot/suspend-goal/buy-PP marketplace items.

**Architecture:** Tracker types extended in `trackerTypes.ts` + a new `foodLibrary.ts` + Open Food Facts API called client-side. Goal-tree edit gate bypassed via existing `is_admin` flag set in Supabase. `pointsController.ts` gets `suspend_goal` item; `goalController.ts` wired to count `goal_slot` purchases; `stripeController.ts` gets a new `create-pp-checkout` endpoint.

**Tech Stack:** React + MUI v7, Supabase (direct client), Express + TypeScript, Stripe Node SDK

---

## Task 1: Add Step Counter Tracker

**Files:**
- Modify: `client/src/features/trackers/trackerTypes.ts`

**Step 1: Add the `steps` tracker type** to `TRACKER_TYPES` array (insert after `cardio`, before `study`):

```typescript
{
  id: 'steps',
  label: 'Step Counter',
  icon: '👟',
  description: 'Track daily steps toward your activity goal',
  color: '#F97316',
  bg: 'rgba(249,115,22,0.08)',
  border: 'rgba(249,115,22,0.25)',
  fields: [
    { key: 'steps', label: 'Steps', type: 'number', placeholder: '10000' },
    { key: 'goal', label: 'Daily Goal', type: 'number', placeholder: '10000', optional: true },
    { key: 'source', label: 'Source', type: 'select', options: ['Manual', 'Apple Health', 'Garmin', 'Fitbit', 'Google Fit'], optional: true },
  ],
  entryLabel: d => `${Number(d.steps).toLocaleString()} steps${d.goal ? ` / ${Number(d.goal).toLocaleString()} goal` : ''}`,
},
```

**Step 2: Add `steps` to `DOMAIN_TRACKER_MAP`** for FITNESS domain:

```typescript
[Domain.FITNESS]: ['lift', 'cardio', 'meal', 'steps'],
```

**Step 3: Verify TypeScript** — from `client/`:
```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**
```bash
git add client/src/features/trackers/trackerTypes.ts
git commit -m "feat: add step counter tracker type"
```

---

## Task 2: Add Exercise Autocomplete Library

**Files:**
- Create: `client/src/features/trackers/exerciseLibrary.ts`
- Modify: `client/src/features/trackers/TrackerSection.tsx`
- Modify: `client/src/features/trackers/TrackerWidget.tsx`

**Step 1: Create `exerciseLibrary.ts`**

```typescript
export interface ExerciseEntry {
  name: string;
  muscle: string;
}

export const EXERCISE_LIBRARY: ExerciseEntry[] = [
  // Chest
  { name: 'Bench Press', muscle: 'Chest' },
  { name: 'Incline Bench Press', muscle: 'Chest' },
  { name: 'Decline Bench Press', muscle: 'Chest' },
  { name: 'Dumbbell Fly', muscle: 'Chest' },
  { name: 'Push-Up', muscle: 'Chest' },
  { name: 'Cable Crossover', muscle: 'Chest' },
  // Back
  { name: 'Deadlift', muscle: 'Back' },
  { name: 'Barbell Row', muscle: 'Back' },
  { name: 'Pull-Up', muscle: 'Back' },
  { name: 'Lat Pulldown', muscle: 'Back' },
  { name: 'Seated Cable Row', muscle: 'Back' },
  { name: 'T-Bar Row', muscle: 'Back' },
  { name: 'Dumbbell Row', muscle: 'Back' },
  // Shoulders
  { name: 'Overhead Press', muscle: 'Shoulders' },
  { name: 'Dumbbell Lateral Raise', muscle: 'Shoulders' },
  { name: 'Front Raise', muscle: 'Shoulders' },
  { name: 'Arnold Press', muscle: 'Shoulders' },
  { name: 'Face Pull', muscle: 'Shoulders' },
  // Arms
  { name: 'Barbell Curl', muscle: 'Biceps' },
  { name: 'Dumbbell Curl', muscle: 'Biceps' },
  { name: 'Hammer Curl', muscle: 'Biceps' },
  { name: 'Preacher Curl', muscle: 'Biceps' },
  { name: 'Tricep Pushdown', muscle: 'Triceps' },
  { name: 'Skull Crusher', muscle: 'Triceps' },
  { name: 'Dips', muscle: 'Triceps' },
  { name: 'Overhead Tricep Extension', muscle: 'Triceps' },
  // Legs
  { name: 'Squat', muscle: 'Quads' },
  { name: 'Front Squat', muscle: 'Quads' },
  { name: 'Leg Press', muscle: 'Quads' },
  { name: 'Leg Extension', muscle: 'Quads' },
  { name: 'Romanian Deadlift', muscle: 'Hamstrings' },
  { name: 'Leg Curl', muscle: 'Hamstrings' },
  { name: 'Hip Thrust', muscle: 'Glutes' },
  { name: 'Bulgarian Split Squat', muscle: 'Glutes' },
  { name: 'Lunges', muscle: 'Glutes' },
  { name: 'Calf Raise', muscle: 'Calves' },
  { name: 'Seated Calf Raise', muscle: 'Calves' },
  // Core
  { name: 'Plank', muscle: 'Core' },
  { name: 'Crunch', muscle: 'Core' },
  { name: 'Ab Rollout', muscle: 'Core' },
  { name: 'Hanging Leg Raise', muscle: 'Core' },
  { name: 'Cable Crunch', muscle: 'Core' },
  // Compound / Full-body
  { name: 'Power Clean', muscle: 'Full Body' },
  { name: 'Clean and Jerk', muscle: 'Full Body' },
  { name: 'Snatch', muscle: 'Full Body' },
  { name: 'Farmer\'s Walk', muscle: 'Full Body' },
  { name: 'Kettlebell Swing', muscle: 'Full Body' },
];

export function searchExercises(query: string): ExerciseEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return EXERCISE_LIBRARY.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8);
}
```

**Step 2: Update the log dialog in `TrackerWidget.tsx` and `TrackerSection.tsx`**

In both files, find the TextField rendered for the `exercise` field (inside the `logTracker.def.fields.map` render). Replace just that field's TextField with an Autocomplete-aware version:

```tsx
// At the top of the file, add imports:
import Autocomplete from '@mui/material/Autocomplete';
import { searchExercises } from './exerciseLibrary';

// In the fields.map, replace the plain TextField for field.key === 'exercise':
field.key === 'exercise' ? (
  <Autocomplete
    key={field.key}
    freeSolo
    options={searchExercises(logFields['exercise'] ?? '')}
    getOptionLabel={o => typeof o === 'string' ? o : o.name}
    groupBy={o => typeof o === 'string' ? '' : o.muscle}
    inputValue={logFields['exercise'] ?? ''}
    onInputChange={(_, v) => setLogFields(p => ({ ...p, exercise: v }))}
    onChange={(_, v) => {
      if (v && typeof v !== 'string') setLogFields(p => ({ ...p, exercise: v.name }));
    }}
    renderInput={params => (
      <TextField {...params} label="Exercise *" size="small" placeholder="e.g. Bench Press" fullWidth />
    )}
  />
) : (
  // existing TextField JSX unchanged
)
```

**Step 3: Verify TypeScript**
```bash
cd client && npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**
```bash
git add client/src/features/trackers/exerciseLibrary.ts \
        client/src/features/trackers/TrackerSection.tsx \
        client/src/features/trackers/TrackerWidget.tsx
git commit -m "feat: exercise autocomplete library for lift tracker"
```

---

## Task 3: Food Library + Calorie Lookup in Meal Tracker

**Files:**
- Create: `client/src/features/trackers/foodLibrary.ts`
- Modify: `client/src/features/trackers/TrackerSection.tsx`
- Modify: `client/src/features/trackers/TrackerWidget.tsx`

**Step 1: Create `foodLibrary.ts`** — ~120 common foods with kcal/100g

```typescript
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
  // Fast Food / Common Meals
  { name: 'Pizza (Margherita slice)', kcalPer100g: 266, category: 'Fast Food' },
  { name: 'Burger (beef patty)', kcalPer100g: 295, category: 'Fast Food' },
  { name: 'French Fries', kcalPer100g: 312, category: 'Fast Food' },
];

export function searchFoods(query: string): FoodEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return FOOD_LIBRARY.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
}

/** Fetch from Open Food Facts — returns kcal/100g or null if not found */
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
```

**Step 2: Build `useFoodSearch` hook inline** — add to `TrackerSection.tsx` and `TrackerWidget.tsx` (same logic, just inside the file at the top level):

```tsx
// Helper hook — add near top of file, outside component
function useFoodSearch(query: string) {
  const [results, setResults] = React.useState<{ name: string; kcalPer100g: number }[]>([]);
  React.useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    // Curated first
    const local = searchFoods(query).map(f => ({ name: f.name, kcalPer100g: f.kcalPer100g }));
    if (local.length > 0) { setResults(local); return; }
    // Fallback to Open Food Facts
    let active = true;
    fetchCaloriesFromOFF(query).then(r => { if (active) setResults(r); });
    return () => { active = false; };
  }, [query]);
  return results;
}
```

**Step 3: Wire it into the meal tracker log dialog**

In both `TrackerWidget.tsx` and `TrackerSection.tsx`, in the `fields.map` render, replace the `food` field TextField with:

```tsx
// add at top of file:
import { searchFoods, fetchCaloriesFromOFF } from './foodLibrary';

// in fields.map, for field.key === 'food':
field.key === 'food' ? (
  <Autocomplete
    key={field.key}
    freeSolo
    options={useFoodSearch(logFields['food'] ?? '')}  // NOTE: call the hook outside map — see Step 4
    getOptionLabel={o => typeof o === 'string' ? o : `${o.name} (${o.kcalPer100g} kcal/100g)`}
    groupBy={() => ''}
    inputValue={logFields['food'] ?? ''}
    onInputChange={(_, v) => setLogFields(p => ({ ...p, food: v }))}
    onChange={(_, v) => {
      if (v && typeof v !== 'string') {
        setLogFields(p => ({
          ...p,
          food: v.name,
          calories: String(v.kcalPer100g),
        }));
      }
    }}
    renderInput={params => (
      <TextField {...params} label="What did you eat? *" size="small" fullWidth />
    )}
  />
) : (
  // existing TextField JSX
)
```

> **Note on hook rules:** Because `useFoodSearch` is a hook it can't be called inside `.map()`. Instead, call it at the component level with the current food query:
> ```tsx
> const foodResults = useFoodSearch(logFields['food'] ?? '');
> ```
> Then reference `foodResults` in the Autocomplete `options` prop.

**Step 4: Verify TypeScript**
```bash
cd client && npx tsc --noEmit
```
Expected: 0 errors.

**Step 5: Commit**
```bash
git add client/src/features/trackers/foodLibrary.ts \
        client/src/features/trackers/TrackerSection.tsx \
        client/src/features/trackers/TrackerWidget.tsx
git commit -m "feat: food calorie library + Open Food Facts fallback for meal tracker"
```

---

## Task 4: Enable Unlimited Goal-Tree Editing for Gio

**Files:**
- No code change required — the backend already gates on `profiles.is_admin`.

**Step 1: Run this SQL in Supabase dashboard (SQL Editor)**

```sql
UPDATE public.profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'pezzingiovaniantonio@gmail.com'
);
```

Expected: 1 row updated.

**Step 2: Verify in Supabase table editor** — `profiles` row for gio should have `is_admin = true`.

**Step 3: Also reset edit count so he has a clean slate**

```sql
UPDATE public.profiles
SET goal_tree_edit_count = 0
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'pezzingiovaniantonio@gmail.com'
);
```

**Step 4: No commit needed** — pure DB change. Note it in `manual_actions.txt`.

---

## Task 5: Wire `goal_slot` Purchase to Actual Goal Limit

**Files:**
- Modify: `src/controllers/goalController.ts`

**Step 1: Read the current root-goal-limit block** (around line 184–195 in `goalController.ts`).

**Step 2: Replace the limit check** to count purchased goal slots from `marketplace_transactions`:

```typescript
// Replace the existing rootGoalLimit block (around lines 184–195) with:
const rootGoalLimit = 3;

// Count extra slots purchased
const { count: extraSlots } = await supabase
  .from('marketplace_transactions')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('item_type', 'goal_slot');

const effectiveLimit = rootGoalLimit + (extraSlots ?? 0);

if (!isPremium && !isAdmin && safeRootNodes.length > effectiveLimit) {
  throw new ForbiddenError(
    `You are limited to ${effectiveLimit} primary goals. Purchase an Extra Goal Slot (200 PP) or upgrade to premium.`
  );
}
```

**Step 3: Verify TypeScript** from root:
```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**
```bash
git add src/controllers/goalController.ts
git commit -m "feat: wire goal_slot purchases to root-goal limit"
```

---

## Task 6: Add `suspend_goal` to Points Catalogue + Backend Handler

**Files:**
- Modify: `src/controllers/pointsController.ts`
- Modify: `src/controllers/goalController.ts`

**Step 1: Add `suspend_goal` to `SPEND_CATALOGUE`** in `pointsController.ts`:

```typescript
// Add to SPEND_CATALOGUE:
suspend_goal: { cost: 50, label: 'Suspend a Goal (pause without deleting)' },
```

**Step 2: Handle `suspend_goal` in `spendPoints`** — the item needs a `nodeId` in the request body:

In `spendPoints`, update the signature check and add an effect handler:

```typescript
// Update destructuring at the top of spendPoints:
const { userId, item, nodeId } = req.body as { userId?: string; item?: string; nodeId?: string };

// After the existing if (item === 'boost_visibility') block, add:
if (item === 'suspend_goal') {
  if (!nodeId) throw new BadRequestError('nodeId is required for suspend_goal');
  // Fetch goal tree
  const { data: treeRow } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('userId', userId)
    .maybeSingle();

  if (!treeRow?.nodes) throw new NotFoundError('Goal tree not found');
  const nodes: any[] = Array.isArray(treeRow.nodes) ? treeRow.nodes : [];
  const nodeIndex = nodes.findIndex((n: any) => n.id === nodeId);
  if (nodeIndex === -1) throw new BadRequestError('Node not found in goal tree');
  nodes[nodeIndex] = { ...nodes[nodeIndex], status: 'suspended' };

  await supabase.from('goal_trees').update({ nodes }).eq('userId', userId);
  updates.suspendedNodeId = nodeId; // record for response
}
```

**Step 3: Verify TypeScript** from root:
```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**
```bash
git add src/controllers/pointsController.ts src/controllers/goalController.ts
git commit -m "feat: add suspend_goal marketplace item (50 PP)"
```

---

## Task 7: Show Suspended Nodes as Greyed Out in Visualization

**Files:**
- Modify: `client/src/features/goals/components/GoalTreeVisualization.tsx`

**Step 1: Read the file** to find where node color/opacity is set.

**Step 2: Add suspension check** — wherever the node SVG/rect is rendered, add:

```tsx
const isSuspended = (node.data as any).status === 'suspended';

// On the node container element, add:
style={{ opacity: isSuspended ? 0.35 : 1, filter: isSuspended ? 'grayscale(0.8)' : 'none' }}
```

Also add a "⏸ Suspended" badge label below the node title when `isSuspended`.

**Step 3: Verify TypeScript**
```bash
cd client && npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add client/src/features/goals/components/GoalTreeVisualization.tsx
git commit -m "ux: greyed-out suspended nodes in goal tree visualization"
```

---

## Task 8: Stripe PP Purchase Endpoint (Backend)

**Files:**
- Modify: `src/controllers/stripeController.ts`
- Modify: `src/routes/stripeRoutes.ts`

**Step 1: Add PP tiers constant** to `stripeController.ts`:

```typescript
const PP_TIERS: Record<string, { pp: number; amountCents: number; label: string }> = {
  pp_500:  { pp: 500,  amountCents: 499,  label: '500 Praxis Points' },
  pp_1100: { pp: 1100, amountCents: 999,  label: '1100 Praxis Points' },
  pp_3000: { pp: 3000, amountCents: 2499, label: '3000 Praxis Points' },
};
```

**Step 2: Add `createPPCheckout` controller** to `stripeController.ts`:

```typescript
export const createPPCheckout = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId, email, tier } = req.body as { userId?: string; email?: string; tier?: string };
  if (!userId || !email || !tier) throw new BadRequestError('userId, email, and tier are required');
  if (!PP_TIERS[tier]) throw new BadRequestError(`Invalid tier. Valid: ${Object.keys(PP_TIERS).join(', ')}`);

  const { amountCents, pp, label } = PP_TIERS[tier];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: amountCents,
        product_data: { name: label, description: 'Praxis Points — spend in marketplace' },
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL}/dashboard?pp_purchased=${pp}`,
    cancel_url: `${process.env.CLIENT_URL}/dashboard`,
    client_reference_id: userId,
    customer_email: email,
    metadata: { userId, pp: String(pp), purchase_type: 'pp' },
  });

  res.status(200).json({ sessionId: session.id, url: session.url });
});
```

**Step 3: Handle `checkout.session.completed` for PP purchases** in `handleWebhook`:

In the existing `case 'checkout.session.completed':` block, **before** the subscription upsert logic, add:

```typescript
// PP purchase (one-time payment, not subscription)
if (session.metadata?.purchase_type === 'pp') {
  const ppAmount = parseInt(session.metadata.pp ?? '0', 10);
  const ppUserId = session.metadata.userId;
  if (ppUserId && ppAmount > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('praxis_points')
      .eq('id', ppUserId)
      .single();
    const current = profile?.praxis_points ?? 0;
    await supabase.from('profiles').update({ praxis_points: current + ppAmount }).eq('id', ppUserId);
    logger.info(`Credited ${ppAmount} PP to user ${ppUserId}`);
  }
  return res.json({ received: true });
}
```

**Step 4: Register route** in `stripeRoutes.ts`:

```typescript
import { createCheckoutSession, handleWebhook, createPPCheckout } from '../controllers/stripeController';

router.post('/create-pp-checkout', createPPCheckout);
```

**Step 5: Verify TypeScript** from root:
```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 6: Commit**
```bash
git add src/controllers/stripeController.ts src/routes/stripeRoutes.ts
git commit -m "feat: Stripe PP purchase endpoint (500/1100/3000 PP tiers)"
```

---

## Task 9: PP Purchase UI in Marketplace / Points Page

**Files:**
- Modify or Create: `client/src/features/points/PointsPage.tsx` (check if exists, else check where the marketplace lives)

**Step 1: Find existing marketplace/points UI**
```bash
find client/src -name "*Points*" -o -name "*Marketplace*" -o -name "*points*"
```

**Step 2: Add a "Buy Praxis Points" section** with three tier cards:

```tsx
const PP_TIERS = [
  { tier: 'pp_500',  pp: 500,  price: '€4.99',  label: 'Starter' },
  { tier: 'pp_1100', pp: 1100, price: '€9.99',  label: 'Popular', highlight: true },
  { tier: 'pp_3000', pp: 3000, price: '€24.99', label: 'Best Value' },
];

// Handler:
const handleBuyPP = async (tier: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const res = await axios.post(`${API_URL}/stripe/create-pp-checkout`, {
    userId: user.id,
    email: user.email,
    tier,
  });
  window.location.href = res.data.url;
};

// Render three cards using MUI Card + Button:
{PP_TIERS.map(t => (
  <Card key={t.tier} variant="outlined" sx={{
    p: 2, textAlign: 'center', flex: 1,
    border: t.highlight ? '2px solid #A78BFA' : undefined,
  }}>
    <Typography variant="caption" color="text.secondary">{t.label}</Typography>
    <Typography variant="h5" sx={{ fontWeight: 800, color: '#A78BFA' }}>⚡ {t.pp.toLocaleString()}</Typography>
    <Typography variant="body2" sx={{ mb: 2 }}>{t.price}</Typography>
    <Button fullWidth variant={t.highlight ? 'contained' : 'outlined'} onClick={() => handleBuyPP(t.tier)}
      sx={{ borderRadius: '10px', background: t.highlight ? 'linear-gradient(135deg, #8B5CF6, #A78BFA)' : undefined }}>
      Buy
    </Button>
  </Card>
))}
```

**Step 3: Verify TypeScript**
```bash
cd client && npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add client/src/features/points/
git commit -m "feat: buy Praxis Points UI with three Stripe tiers"
```

---

## Task 10: Suspend Goal UI in Goal Tree Page

**Files:**
- Modify: `client/src/features/goals/GoalTreePage.tsx`

**Step 1: Add suspend dialog state** near the other dialog states (around line 98):

```tsx
const [suspendNode, setSuspendNode] = useState<FrontendGoalNode | null>(null);
const [suspending, setSuspending] = useState(false);
```

**Step 2: Add "Suspend" option to the action chooser dialog** — in the `actionNode` dialog, add a button:

```tsx
<Button
  fullWidth variant="outlined" color="warning"
  onClick={() => { setActionNode(null); setSuspendNode(actionNode); }}
  sx={{ borderRadius: '10px', justifyContent: 'flex-start', pl: 2 }}
>
  ⏸ Suspend Goal (50 PP)
</Button>
```

**Step 3: Add the suspend confirmation dialog**:

```tsx
<Dialog open={!!suspendNode} onClose={() => setSuspendNode(null)} maxWidth="xs" fullWidth>
  <DialogTitle>Suspend Goal</DialogTitle>
  <DialogContent>
    <Typography variant="body2" sx={{ mb: 1 }}>
      Suspending <strong>{suspendNode?.title}</strong> will pause it without deleting it. Costs 50 PP.
    </Typography>
  </DialogContent>
  <DialogActions sx={{ px: 3, pb: 2.5 }}>
    <Button onClick={() => setSuspendNode(null)}>Cancel</Button>
    <Button
      variant="contained" color="warning" disabled={suspending}
      onClick={async () => {
        if (!suspendNode || !currentUserId) return;
        setSuspending(true);
        try {
          await axios.post(`${API_URL}/points/spend`, {
            userId: currentUserId,
            item: 'suspend_goal',
            nodeId: suspendNode.id,
          });
          toast.success('Goal suspended!');
          setSuspendNode(null);
          // Reload tree
          window.location.reload();
        } catch (e: any) {
          toast.error(e.response?.data?.message || 'Failed to suspend goal');
        } finally {
          setSuspending(false);
        }
      }}
      sx={{ borderRadius: '10px' }}
    >
      {suspending ? <CircularProgress size={18} color="inherit" /> : 'Confirm (50 PP)'}
    </Button>
  </DialogActions>
</Dialog>
```

**Step 4: Verify TypeScript**
```bash
cd client && npx tsc --noEmit
```

**Step 5: Commit**
```bash
git add client/src/features/goals/GoalTreePage.tsx
git commit -m "feat: suspend goal UI (50 PP, from action dialog)"
```

---

## Final Verification

1. Run backend TS check: `npx tsc --noEmit` → 0 errors
2. Run frontend TS check: `cd client && npx tsc --noEmit` → 0 errors
3. Smoke test: open TrackerWidget, log a meal, type "chick" → curated results appear with kcal
4. Smoke test: open TrackerWidget, log a lift, type "bench" → exercise autocomplete appears
5. Smoke test: step counter tracker appears for fitness-domain users
6. Smoke test: GoalTree action dialog has "Suspend Goal" option
7. Verify Supabase: gio's profile has `is_admin = true`
8. Stripe: test PP purchase flow with Stripe test card `4242 4242 4242 4242`

---

## Manual Actions Required (Supabase + Stripe)

Add to `manual_actions.txt`:

```
[Session 57 — Tracker + Marketplace]
M1. Run in Supabase SQL Editor:
    UPDATE public.profiles SET is_admin = true
    WHERE id = (SELECT id FROM auth.users WHERE email = 'pezzingiovaniantonio@gmail.com');

M2. Run in Supabase SQL Editor:
    UPDATE public.profiles SET goal_tree_edit_count = 0
    WHERE id = (SELECT id FROM auth.users WHERE email = 'pezzingiovaniantonio@gmail.com');

M3. Add to Railway env vars (if not present):
    CLIENT_URL = https://your-vercel-domain.vercel.app

M4. Stripe: no new price IDs needed — PP checkout uses price_data (inline pricing).
    Ensure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set on Railway.
    Re-register webhook to also listen to: checkout.session.completed (already registered).
```
