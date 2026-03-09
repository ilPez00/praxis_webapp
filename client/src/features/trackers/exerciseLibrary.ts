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
  // Full Body
  { name: 'Power Clean', muscle: 'Full Body' },
  { name: 'Clean and Jerk', muscle: 'Full Body' },
  { name: 'Snatch', muscle: 'Full Body' },
  { name: "Farmer's Walk", muscle: 'Full Body' },
  { name: 'Kettlebell Swing', muscle: 'Full Body' },
];

export function searchExercises(query: string): ExerciseEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return EXERCISE_LIBRARY.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8);
}
