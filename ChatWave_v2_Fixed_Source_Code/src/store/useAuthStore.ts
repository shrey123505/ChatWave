import { create } from 'zustand';
import type { User } from 'firebase/auth';

export const ALL_THEME_CLASSES = [
  'theme-default',
  'theme-aurora',
  'theme-blue',
  'theme-rose',
  'theme-emerald',
  'theme-amoled'
];

interface AuthState {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  theme: string;
  setUser: (user: User | null) => void;
  setUserProfile: (profile: any) => void;
  setTheme: (theme: string) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const savedTheme = localStorage.getItem('chatwave-theme') || 'theme-default';
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove(...ALL_THEME_CLASSES);
    document.documentElement.classList.add(savedTheme);
  }

  return {
    user: null,
    userProfile: null,
    loading: true,
    theme: savedTheme,
    setUser: (user) => set((state) => ({ user, loading: false, userProfile: user ? state.userProfile : null })),
    setUserProfile: (userProfile) => set({ userProfile }),
    setTheme: (theme) => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove(...ALL_THEME_CLASSES);
        document.documentElement.classList.add(theme);
      }
      localStorage.setItem('chatwave-theme', theme);
      set({ theme });
    }
  };
});
