import { create } from 'zustand';
import type { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  theme: string;
  setUser: (user: User | null) => void;
  setTheme: (theme: string) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const savedTheme = localStorage.getItem('chatwave-theme') || 'theme-default';
  if (savedTheme !== 'theme-default') {
    document.documentElement.classList.add(savedTheme);
  }

  return {
    user: null,
    loading: true,
    theme: savedTheme,
    setUser: (user) => set({ user, loading: false }),
    setTheme: (theme) => {
      document.documentElement.classList.remove('theme-blue', 'theme-rose', 'theme-emerald');
      if (theme !== 'theme-default') {
        document.documentElement.classList.add(theme);
      }
      localStorage.setItem('chatwave-theme', theme);
      set({ theme });
    }
  };
});
