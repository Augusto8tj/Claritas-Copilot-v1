'use client';

import * as React from 'react';

type Theme = 'light' | 'dark' | 'theme-ocean' | 'theme-desert' | 'theme-forest';
type Font = 'font-body' | 'font-roboto' | 'font-lato' | 'font-courier' | 'font-script';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  font: Font;
  setFont: (font: Font) => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(
  undefined
);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>('light');
  const [font, setFontState] = React.useState<Font>('font-body');

  React.useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    if (storedTheme) {
      setThemeState(storedTheme);
    }
    const storedFont = localStorage.getItem('font') as Font | null;
    if (storedFont) {
        setFontState(storedFont);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setFont = (newFont: Font) => {
    setFontState(newFont);
    localStorage.setItem('font', newFont);
  }

  React.useEffect(() => {
    document.body.className = '';
    document.body.classList.add('antialiased', theme, font);
  }, [theme, font]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, font, setFont }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
