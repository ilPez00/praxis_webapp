export function getAxiomQuote(streak: number): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const pools = {
    elite: [
      `${streak} days. Most people quit before they even start. You didn't.`,
      "You've built something most people only talk about. Keep compounding.",
      "The gap between you and where you started is bigger than you think.",
    ],
    veteran: [
      "Two weeks in. This is where most people fall off. You haven't.",
      "Consistency is a skill. You're getting very good at it.",
      "Your streak is sending a message to your future self.",
    ],
    active: [
      "Every day you show up is a vote for the person you're becoming.",
      "Progress isn't always visible. But it's always real.",
      "Small moves, compounded. That's the whole game.",
    ],
    new: [
      `Day ${streak > 0 ? streak : 1}. The journey starts here.`,
      "What gets measured gets better. You're here. That counts.",
      "Your goals are alive as long as you keep showing up.",
    ],
  };
  const pool =
    streak >= 30 ? pools.elite :
    streak >= 14 ? pools.veteran :
    streak >= 3  ? pools.active :
    pools.new;
  return pool[dayOfYear % pool.length];
}
