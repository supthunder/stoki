"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Cookies from "js-cookie";

// Define user type
export type User = {
  id: number;
  username: string;
  avatar?: string;
};

// Define context type
type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
  updateAvatar: (avatarUrl: string, base64Image?: string) => Promise<void>;
};

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cookie name
const USER_COOKIE = "stoki_user";
// Cookie expiration (30 days)
const COOKIE_EXPIRATION = 30;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing user cookie on load - only in browser
  useEffect(() => {
    const checkUser = async () => {
      try {
        // Ensure this only runs client-side
        if (typeof window === 'undefined') return;
        
        const userCookie = Cookies.get(USER_COOKIE);
        if (userCookie) {
          const userData = JSON.parse(userCookie);
          // Verify user exists in database via API
          const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: userData.username })
          });
          
          const data = await response.json();
          
          if (data.success && data.user) {
            setUser(data.user);
          } else {
            // User doesn't exist in the database, clear cookie
            Cookies.remove(USER_COOKIE);
          }
        }
      } catch (error) {
        console.error("Error checking user:", error);
        // If there's an error, clear the cookie
        if (typeof window !== 'undefined') {
          Cookies.remove(USER_COOKIE);
        }
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  // Login function
  const login = async (username: string) => {
    try {
      setLoading(true);
      
      // Create or get existing user via API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      // Set user in state
      setUser(data.user);
      
      // Save user in cookie (30 days) - only in browser
      if (typeof window !== 'undefined') {
        Cookies.set(USER_COOKIE, JSON.stringify(data.user), { 
          expires: COOKIE_EXPIRATION,
          sameSite: 'strict'
        });
      }
    } catch (error) {
      console.error("Error during login:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      Cookies.remove(USER_COOKIE);
    }
  };

  const updateAvatar = async (avatarUrl: string, base64Image?: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          userId: user.id, 
          avatarUrl: base64Image || avatarUrl 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update avatar');
      }

      const data = await response.json();
      
      if (data.success) {
        // Update user in state and cookie
        const updatedUser = { ...user, avatar: base64Image || avatarUrl };
        setUser(updatedUser);
        Cookies.set(USER_COOKIE, JSON.stringify(updatedUser), { expires: COOKIE_EXPIRATION });
      } else {
        throw new Error(data.message || 'Failed to update avatar');
      }
    } catch (error) {
      console.error('Error updating avatar:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
} 