/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./web/html/family-time-flow/index.html'],
  theme: {
    extend: {
      colors: {
        'theme-student': {
          bg: '#F0F9FF',
          accent: '#1D4ED8',
          surface: '#FFFFFF',
          muted: '#DBEAFE',
          border: '#93C5FD',
          text: '#0F3D56'
        },
        'theme-worker': {
          bg: '#FFFBEB',
          accent: '#B45309',
          surface: '#FFFFFF',
          muted: '#FEF3C7',
          border: '#FCD34D',
          text: '#5C2C0B'
        },
        'theme-family': {
          bg: '#FFF7ED',
          accent: '#C2410C',
          surface: '#FFFFFF',
          muted: '#FFEDD5',
          border: '#FDBA74',
          text: '#64220C'
        }
      },
      fontFamily: {
        mono: ['"SF Mono"', 'Monaco', 'Inconsolata', '"Fira Code"', 'monospace'],
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif']
      }
    }
  },
  daisyui: {
    logs: false,
    themes: ['light']
  },
  plugins: [require('daisyui')]
};
