import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, safeSetDoc } from '../firebase';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ResolvedTheme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const savedMode = localStorage.getItem('langcert_theme_mode');
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
        return savedMode;
      }
      const legacy = localStorage.getItem('langcert_theme');
      if (legacy === 'light' || legacy === 'dark') {
        return legacy;
      }
    } catch {
      // Ignore storage errors
    }
    return 'system';
  });

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Hydrate theme preference from Cloud Firestore when user signs in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const remoteMode = snap.data()?.preferences?.themeMode;
          if (remoteMode === 'light' || remoteMode === 'dark' || remoteMode === 'system') {
            setThemeModeState(remoteMode);
          }
        }
      } catch {
        // Ignore read error
      }
    });
    return () => unsub();
  }, []);

  // Listen for OS/System theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme: ResolvedTheme = themeMode === 'system' ? systemTheme : themeMode;

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    try {
      localStorage.setItem('langcert_theme_mode', themeMode);
      localStorage.setItem('langcert_theme', resolvedTheme);
    } catch {
      // Ignore storage errors
    }
  }, [themeMode, resolvedTheme]);

  const persistThemeToCloud = (nextMode: ThemeMode) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    safeSetDoc(
      doc(db, 'users', uid),
      {
        preferences: {
          themeMode: nextMode,
          updatedAt: Date.now(),
        },
      },
      { merge: true }
    ).catch(() => {});
  };

  const toggleTheme = () => {
    setThemeModeState((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light';
      persistThemeToCloud(next);
      return next;
    });
  };

  const setThemeMode = (newMode: ThemeMode) => {
    setThemeModeState(newMode);
    persistThemeToCloud(newMode);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        themeMode,
        toggleTheme,
        setTheme: setThemeMode,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
