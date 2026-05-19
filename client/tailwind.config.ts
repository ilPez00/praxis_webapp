import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#080808',
        surface: '#111111',
        raised:  '#1a1a1a',
        border:  '#222222',
        muted:   '#333333',
        dim:     '#666666',
        sub:     '#888888',
        fg:      '#eeeeee',
        amber:   '#F59E0B',
        green:   '#10B981',
        blue:    '#3B82F6',
        red:     '#EF4444',
        purple:  '#A78BFA',
        pink:    '#EC4899',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.625rem',
        xs:    '0.75rem',
        sm:    '0.8125rem',
        base:  '0.875rem',
        md:    '1rem',
        lg:    '1.125rem',
        xl:    '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      },
      borderRadius: {
        sm:   '4px',
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
        full: '9999px',
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
} satisfies Config;
