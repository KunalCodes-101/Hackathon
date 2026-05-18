export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        ink: '#060713',
        panel: '#0D1021',
        line: 'rgba(255,255,255,0.1)',
        violet: '#8B5CF6',
        cyan: '#22D3EE',
        fuchsia: '#D946EF'
      },
      boxShadow: {
        glow: '0 0 80px rgba(139,92,246,0.35)',
        cyan: '0 0 60px rgba(34,211,238,0.22)'
      }
    }
  },
  plugins: []
};
