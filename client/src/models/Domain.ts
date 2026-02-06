export enum Domain {
  // From whitepaper
  CAREER = "Career",
  INVESTING = "Investing",
  FITNESS = "Fitness",
  ACADEMICS = "Academics",
  MENTAL_HEALTH = "Mental Health",
  PHILOSOPHY = "Philosophy",
  CULTURE_HOBBIES = "Culture & Hobbies",
  INTIMACY_ROMANCE = "Intimacy & Romance",
  FRIENDSHIP_SOCIAL = "Friendship & Social",

  // Original simple domains (can be removed if no longer used, but kept for compatibility for now)
  HEALTH = "Health",
  WEALTH = "Wealth",
  WISDOM = "Wisdom",
  RELATIONSHIPS = "Relationships",
  HAPPINESS = "Happiness",
}

// A utility function to get a color for a domain, useful for UI styling
export const getDomainColor = (domain: Domain): string => {
  const colorMap: Record<Domain, string> = {
    [Domain.CAREER]: '#ff6347', // Tomato
    [Domain.INVESTING]: '#4682b4', // SteelBlue
    [Domain.FITNESS]: '#32cd32', // LimeGreen
    [Domain.ACADEMICS]: '#ffd700', // Gold
    [Domain.MENTAL_HEALTH]: '#9370db', // MediumPurple
    [Domain.PHILOSOPHY]: '#8b4513', // SaddleBrown
    [Domain.CULTURE_HOBBIES]: '#ff4500', // OrangeRed
    [Domain.INTIMACY_ROMANCE]: '#ff69b4', // HotPink
    [Domain.FRIENDSHIP_SOCIAL]: '#1e90ff', // DodgerBlue

    // Default colors for original domains
    [Domain.HEALTH]: '#32cd32',
    [Domain.WEALTH]: '#4682b4',
    [Domain.WISDOM]: '#ffd700',
    [Domain.RELATIONSHIPS]: '#ff69b4',
    [Domain.HAPPINESS]: '#ff4500',
  };
  return colorMap[domain] || '#cccccc'; // Return a default color if not found
};