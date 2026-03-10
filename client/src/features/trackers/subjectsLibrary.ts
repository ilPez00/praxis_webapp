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
