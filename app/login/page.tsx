"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginModal } from "@/components/login-modal";

export default function LoginPage() {
  const router = useRouter();

  // If the user navigates directly to /login, show the login modal
  // and redirect to the home page
  useEffect(() => {
    // We don't redirect immediately to allow the login modal to be shown
    // The user will be redirected to the home page after login
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <LoginModal initialOpen={true} />
    </div>
  );
} 