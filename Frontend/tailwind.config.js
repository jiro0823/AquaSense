export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Theme
        primary: '#1E3A8A', // Dark blue
        accent: '#06B6D4', // Aqua/cyan
        background: '#FFFFFF', // White
        surface: '#F8FAFC', // Light gray
        
        // Status Colors
        success: '#10B981', // Green
        warning: '#F59E0B', // Yellow
        danger: '#EF4444', // Red
        
        // Semantic colors
        text: {
          primary: '#1F2937', // Dark gray/black
          secondary: '#6B7280', // Medium gray
          light: '#9CA3AF', // Light gray
        },
        
        // Legacy support
        secondary: '#10B981',
        light: '#F8FAFC',
        dark: '#1F2937',
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        'hover': '0 10px 25px -5px rgba(30, 58, 138, 0.15)',
      },
      borderRadius: {
        'sm': '0.375rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
      },
    },
  },
  plugins: [],
};
