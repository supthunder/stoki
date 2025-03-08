"use client";

import React from "react";
import { Home, Trophy, BarChart2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="flex items-center justify-around h-16">
        <NavItem 
          icon={<Home size={24} />} 
          label="Home" 
          isActive={activeTab === "home"} 
          onClick={() => onTabChange("home")} 
          hidden={true}
        />
        <NavItem 
          icon={<Trophy size={24} />} 
          label="Leaderboard" 
          isActive={activeTab === "leaderboard"} 
          onClick={() => onTabChange("leaderboard")} 
        />
        <NavItem 
          icon={<BarChart2 size={24} />} 
          label="Portfolio" 
          isActive={activeTab === "portfolio"} 
          onClick={() => onTabChange("portfolio")} 
        />
        <NavItem 
          icon={<User size={24} />} 
          label="Profile" 
          isActive={activeTab === "profile"} 
          onClick={() => onTabChange("profile")} 
          hidden={true}
        />
      </div>
      {/* Safe area padding for iOS devices */}
      <div className="h-6 bg-background" />
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  hidden?: boolean;
}

function NavItem({ icon, label, isActive, onClick, hidden = false }: NavItemProps) {
  if (hidden) return null;
  
  return (
    <button
      className={cn(
        "flex flex-col items-center justify-center w-full h-full transition-colors",
        isActive 
          ? "text-primary" 
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      <div className="mb-1">{icon}</div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
} 