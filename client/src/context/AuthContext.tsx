import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import type { User, Role } from '../types';
import { authApi } from '../api';
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isFirebaseConfigured: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithFirebaseGoogle: () => Promise<void>;
  devLogin: (role: Role) => Promise<void>;
  logout: () => void;
  is2CTeam: boolean;
  isFATeam: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      const savedUser = localStorage.getItem('auth_user');

      if (token && savedUser) {
        try {
          setUser(JSON.parse(savedUser));
          // Refresh user data in background
          const freshUser = await authApi.getMe();
          setUser(freshUser);
          localStorage.setItem('auth_user', JSON.stringify(freshUser));
        } catch (err) {
          console.warn('Session expired or invalid:', err);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const loginWithGoogle = async (credential: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.loginWithGoogle(credential);
      localStorage.setItem('auth_token', res.token);
      localStorage.setItem('auth_user', JSON.stringify(res.user));
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithFirebaseGoogle = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      throw new Error(
        '尚未設定 Firebase 連線金鑰！請在 client/.env 中填入 Firebase 專案設定值（可參考 client/.env.example），或使用下方的測試角色直接登入。'
      );
    }

    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userCredential = GoogleAuthProvider.credentialFromResult(result);
      const googleIdToken = userCredential?.idToken;
      const firebaseIdToken = await result.user.getIdToken();

      const res = await authApi.loginWithGoogle({
        credential: googleIdToken || firebaseIdToken,
        email: result.user.email || undefined,
        name: result.user.displayName || undefined,
        avatarUrl: result.user.photoURL || undefined,
      });

      localStorage.setItem('auth_token', res.token);
      localStorage.setItem('auth_user', JSON.stringify(res.user));
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const devLogin = async (role: Role) => {
    setIsLoading(true);
    try {
      const res = await authApi.devLogin(role);
      localStorage.setItem('auth_token', res.token);
      localStorage.setItem('auth_user', JSON.stringify(res.user));
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    window.location.href = '/login';
  };

  const is2CTeam = user?.role === 'TWO_C_TEAM' || user?.role === 'ADMIN';
  const isFATeam = user?.role === 'FA_TEAM' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isFirebaseConfigured,
        loginWithGoogle,
        loginWithFirebaseGoogle,
        devLogin,
        logout,
        is2CTeam,
        isFATeam,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
