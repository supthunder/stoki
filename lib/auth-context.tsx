"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Cookies from "js-cookie";

// Define user type
export type User = {
  id: number;
  username: string;
  avatar?: string;
};

// Define minimal user type for cookie storage
type MinimalUser = {
  id: number;
  username: string;
  // Only store avatar if it's a URL, not base64
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
// Cookie expiration (90 days instead of 30)
const COOKIE_EXPIRATION = 90;

// Helper function to minimize user data for cookie storage
const minimizeUserForCookie = (user: User): MinimalUser => {
  // Create a minimal version of the user object
  const minimalUser: MinimalUser = {
    id: user.id,
    username: user.username,
  };
  
  // Only include avatar if it's a URL, not a base64 string
  if (user.avatar && !user.avatar.startsWith('data:')) {
    minimalUser.avatar = user.avatar;
  }
  
  return minimalUser;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Debug function to check cookie
  const debugCookie = () => {
    if (typeof window === 'undefined') return;
    const cookie = Cookies.get(USER_COOKIE);
    console.log('Current cookie value:', cookie ? 'Found' : 'Not found');
    if (cookie) {
      try {
        const parsed = JSON.parse(cookie);
        console.log('Parsed cookie:', parsed);
        // Check cookie size
        const cookieSize = new Blob([cookie]).size;
        console.log(`Cookie size: ${cookieSize} bytes (max: 4096 bytes)`);
      } catch (e) {
        console.error('Failed to parse cookie:', e);
      }
    }
  };

  // Check for existing user cookie on load - only in browser
  useEffect(() => {
    const checkUser = async () => {
      try {
        // Ensure this only runs client-side
        if (typeof window === 'undefined') return;
        
        console.log('Checking for user cookie...');
        const userCookie = Cookies.get(USER_COOKIE);
        console.log('User cookie found:', userCookie ? 'Yes' : 'No');
        
        if (userCookie) {
          try {
            const userData = JSON.parse(userCookie);
            console.log('Parsed user data from cookie:', userData);
            
            // Verify user exists in database via API
            console.log('Verifying user with API...');
            const response = await fetch('/api/auth/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ username: userData.username })
            });
            
            const data = await response.json();
            console.log('API verification response:', data);
            
            if (data.success && data.user) {
              console.log('User verified successfully, setting user state');
              setUser(data.user);
              
              // Refresh the cookie to extend its lifetime - use minimal data
              console.log('Refreshing cookie with verified user data');
              const minimalUserData = minimizeUserForCookie(data.user);
              Cookies.set(USER_COOKIE, JSON.stringify(minimalUserData), { 
                expires: COOKIE_EXPIRATION,
                sameSite: 'lax',
                path: '/'
              });
              
              // Debug cookie after setting
              setTimeout(debugCookie, 100);
            } else {
              // User doesn't exist in the database, clear cookie
              console.log('User verification failed, clearing cookie');
              Cookies.remove(USER_COOKIE, { path: '/' });
            }
          } catch (parseError) {
            console.error('Error parsing user cookie:', parseError);
            Cookies.remove(USER_COOKIE, { path: '/' });
          }
        } else {
          console.log('No user cookie found, user is not logged in');
        }
      } catch (error) {
        console.error("Error checking user:", error);
        // If there's an error, clear the cookie
        if (typeof window !== 'undefined') {
          Cookies.remove(USER_COOKIE, { path: '/' });
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
      console.log('Logging in user:', username);
      
      // Create or get existing user via API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });
      
      const data = await response.json();
      console.log('Login API response:', data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      // Set user in state
      console.log('Setting user state after login');
      setUser(data.user);
      
      // Save user in cookie (90 days) - only in browser
      if (typeof window !== 'undefined') {
        console.log('Setting user cookie after login');
        // Use minimal user data for cookie
        const minimalUserData = minimizeUserForCookie(data.user);
        Cookies.set(USER_COOKIE, JSON.stringify(minimalUserData), { 
          expires: COOKIE_EXPIRATION,
          sameSite: 'lax',
          path: '/'
        });
        
        // Debug cookie after setting
        setTimeout(debugCookie, 100);
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
    console.log('Logging out user');
    setUser(null);
    if (typeof window !== 'undefined') {
      Cookies.remove(USER_COOKIE, { path: '/' });
      console.log('Cookie removed during logout');
    }
  };

  const updateAvatar = async (avatarUrl: string, base64Image?: string) => {
    if (!user) return;

    try {
      console.log('Updating avatar for user:', user.id);
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
      console.log('Avatar update API response:', data);
      
      if (data.success) {
        // Update user in state and cookie
        const updatedUser = { ...user, avatar: base64Image || avatarUrl };
        console.log('Setting updated user with new avatar');
        setUser(updatedUser);
        
        console.log('Updating cookie with new avatar');
        // Use minimal user data for cookie - don't store base64 in cookie
        const minimalUserData = minimizeUserForCookie(updatedUser);
        Cookies.set(USER_COOKIE, JSON.stringify(minimalUserData), { 
          expires: COOKIE_EXPIRATION,
          sameSite: 'lax',
          path: '/'
        });
        
        // Debug cookie after setting
        setTimeout(debugCookie, 100);
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