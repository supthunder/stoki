import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { UserMenu } from "@/components/user-menu";
import { Toaster } from "@/components/ui/toaster";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Stoki - Social Stock Trading App",
  description: "Track and share your stock portfolio with friends. A fun social trading platform with real-time data.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Stoki",
    startupImage: [
      {
        url: "/apple-touch-icon.png",
      },
    ],
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: {
      url: '/apple-touch-icon.png',
    },
    other: [
      { 
        rel: 'android-chrome-192x192',
        url: '/android-chrome-192x192.png',
      },
      {
        rel: 'android-chrome-512x512',
        url: '/android-chrome-512x512.png',
      },
    ]
  },
  openGraph: {
    type: "website",
    url: "https://www.stoki.social/",
    title: "Stoki - Social Stock Trading App",
    description: "Track and share your stock portfolio with friends. A fun social trading platform with real-time data.",
    images: [
      {
        url: "https://dp8ya6ppz4ztmtyp.public.blob.vercel-storage.com/stoki-preview-dyKTvFXkchXeDEbZPuFysBiNb046Si.png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stoki - Social Stock Trading App",
    description: "Track and share your stock portfolio with friends. A fun social trading platform with real-time data.",
    images: ["https://dp8ya6ppz4ztmtyp.public.blob.vercel-storage.com/stoki-preview-dyKTvFXkchXeDEbZPuFysBiNb046Si.png"],
    creator: "@stokisocial",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <AuthProvider>
            <div className="absolute top-4 left-4 z-50">
              <UserMenu />
            </div>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('Service Worker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('Service Worker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
} 