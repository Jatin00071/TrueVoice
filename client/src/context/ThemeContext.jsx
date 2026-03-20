import { useEffect, useState } from 'react';
import { ThemeContext } from './themeStore.js';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => window.localStorage.getItem('tv_theme') || 'light');
  const [fontSize, setFontSize] = useState(() => window.localStorage.getItem('tv_fontsize') || 'normal');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('tv_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (fontSize === 'large') {
      document.documentElement.setAttribute('data-fontsize', 'large');
    } else {
      document.documentElement.removeAttribute('data-fontsize');
    }
    window.localStorage.setItem('tv_fontsize', fontSize);
  }, [fontSize]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, fontSize, setFontSize }}>{children}</ThemeContext.Provider>
  );
}
