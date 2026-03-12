export interface DomainConfig {
  value: string;
  label: string;
  color: string;
  icon: string;
}

export const PRAXIS_DOMAINS: DomainConfig[] = [
  { value: 'Body & Health', label: 'Body & Health', color: '#EF4444', icon: '🏋️' },
  { value: 'Mind & Learning', label: 'Mind & Learning', color: '#3B82F6', icon: '🧠' },
  { value: 'Craft & Career', label: 'Craft & Career', color: '#F59E0B', icon: '💼' },
  { value: 'Money & Assets', label: 'Money & Assets', color: '#10B981', icon: '💰' },
  { value: 'Environment & Gear', label: 'Environment & Gear', color: '#6B7280', icon: '🌲' },
  { value: 'Spirit & Purpose', label: 'Spirit & Purpose', color: '#8B5CF6', icon: '✨' },
  { value: 'Culture & Hobbies', label: 'Culture & Hobbies', color: '#EC4899', icon: '🎨' },
  { value: 'Intimacy & Romance', label: 'Intimacy & Romance', color: '#F472B6', icon: '❤️' },
  { value: 'Friendship & Social', label: 'Friendship & Social', color: '#60A5FA', icon: '🤝' },
];

export const getDomainConfig = (value: string): DomainConfig => {
  return PRAXIS_DOMAINS.find(d => d.value === value) || {
    value,
    label: value,
    color: '#6B7280',
    icon: '📍'
  };
};
