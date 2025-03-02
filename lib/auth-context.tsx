"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Cookies from "js-cookie";
import { createUser, getUserByUsername } from "@/lib/db";

// Define user type
export type User = {
  id: number;
  username: string;
};

// Define context type
type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
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

  // Check for existing user cookie on load
  useEffect(() => {
    const checkUser = async () => {
      try {
        const userCookie = Cookies.get(USER_COOKIE);
        if (userCookie) {
          const userData = JSON.parse(userCookie);
          // Verify user exists in database
          const dbUser = await getUserByUsername(userData.username);
          if (dbUser) {
            setUser(dbUser as User);
          } else {
            // User doesn't exist in the database, clear cookie
            Cookies.remove(USER_COOKIE);
          }
        }
      } catch (error) {
        console.error("Error checking user:", error);
        // If there's an error, clear the cookie
        Cookies.remove(USER_COOKIE);
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
      // Create or get existing user
      const newUser = await createUser(username);
      
      // Set user in state
      setUser(newUser as User);
      
      // Save user in cookie (30 days)
      Cookies.set(USER_COOKIE, JSON.stringify(newUser), { 
        expires: COOKIE_EXPIRATION,
        sameSite: 'strict'
      });
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
    Cookies.remove(USER_COOKIE);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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