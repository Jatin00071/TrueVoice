import { useContext } from 'react';
import { ThemeContext } from '../context/themeStore.js';

export function useTheme() {
  return useContext(ThemeContext);
}
