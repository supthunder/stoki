"use client";

import { useEffect, useState } from "react";

// Hook to detect if the device is mobile (specifically iPhone)
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      // Check if window is defined (to avoid SSR issues)
      if (typeof window !== 'undefined') {
        // Check if device is mobile based on screen width
        const mobile = window.innerWidth <= 768;
        setIsMobile(mobile);
        
        // Check if device is iOS (iPhone, iPad, iPod)
        const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        setIsIOS(ios);
      }
    };

    // Initial check
    checkDevice();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkDevice);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return { isMobile, isIOS };
} 