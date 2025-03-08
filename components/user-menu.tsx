"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Upload, User } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { LoginModal } from "@/components/login-modal";

export function UserMenu() {
  const { user, logout, updateAvatar } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    if (!user) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      // Create a FormData object
      const formData = new FormData();
      formData.append("file", file);

      // Upload the file
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        throw new Error(uploadData.message || "Failed to upload image");
      }

      // Update the user's avatar with the base64 image if available
      await updateAvatar(uploadData.url, uploadData.base64);

      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: "Failed to update avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (!user) {
    return <LoginModal />;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8 bg-muted">
              {user.avatar ? (
                <AvatarImage 
                  src={user.avatar.startsWith('data:') ? user.avatar : 
                       user.avatar.startsWith('/') ? user.avatar : 
                       `/${user.avatar}`} 
                  alt={user.username} 
                />
              ) : null}
              <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="flex items-center justify-start gap-2 p-2">
            <div className="flex flex-col space-y-1 leading-none">
              <p className="font-medium">{user.username}</p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleAvatarClick} disabled={isUploading}>
            <Upload className="mr-2 h-4 w-4" />
            <span>{isUploading ? "Uploading..." : "Upload Avatar"}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </>
  );
} 