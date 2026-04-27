import { create } from 'zustand';

type User = { id: string; email: string; full_name: string; phone_number?: string | null } | null;

interface AuthState {
  user: User;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('demo_user');
    }
    set({ user: null });
  },
}));
