export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        ink: 'var(--color-bg)',
        panel: 'var(--color-panel)',
        raised: 'var(--color-raised)',
        line: 'var(--color-line)',
        muted: 'var(--color-muted)',
        teal: 'var(--color-accent)',
        green: 'var(--color-green)',
        amber: 'var(--color-amber)',
        danger: 'var(--color-danger)',
        body: 'var(--color-text)'
      },
      boxShadow: {
        focus: '0 0 0 1px rgba(45,212,191,0.32)'
      }
    }
  },
  plugins: []
};
