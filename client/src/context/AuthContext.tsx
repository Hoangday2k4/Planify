import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  phone?: string;
  role: string;
  shareToken?: string | null;
  shareExpiresAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => void;
  updateUserLocal: (updatedUser: Partial<User>, newToken?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.user);
          localStorage.setItem('user', JSON.stringify(res.data.user));
        } catch (err) {
          console.error('Không thể đồng bộ thông tin user từ server', err);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (emailOrUsername: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { emailOrUsername, password });
      const { token: receivedToken, user: receivedUser } = res.data;
      
      setToken(receivedToken);
      setUser(receivedUser);
      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(receivedUser));
    } catch (err: any) {
      console.error('Lỗi API Login:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Đăng nhập thất bại.';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string, phone?: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/register', { username, email, password, phone });
      const { token: receivedToken, user: receivedUser } = res.data;
      
      setToken(receivedToken);
      setUser(receivedUser);
      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(receivedUser));
    } catch (err: any) {
      console.error('Lỗi API Register:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Đăng ký thất bại.';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateUserLocal = (updatedUser: Partial<User>, newToken?: string) => {
    if (user) {
      const newUserData = { ...user, ...updatedUser };
      setUser(newUserData);
      localStorage.setItem('user', JSON.stringify(newUserData));
    }
    if (newToken) {
      setToken(newToken);
      localStorage.setItem('token', newToken);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUserLocal }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
