export default function Head() {
  return (
    <>
      <link rel="icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/manifest.json" />
      <link rel="manifest" href="/site.webmanifest" />
      <meta name="theme-color" content="#000000" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://stoki-sigma.vercel.app/" />
      <meta property="og:title" content="Stoki - Social Stock Trading App" />
      <meta property="og:description" content="Track and share your stock portfolio with friends. A fun social trading platform with real-time data." />
      <meta property="og:image" content="https://stoki-sigma.vercel.app/stoki-preview.png" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content="https://stoki-sigma.vercel.app/" />
      <meta property="twitter:title" content="Stoki - Social Stock Trading App" />
      <meta property="twitter:description" content="Track and share your stock portfolio with friends. A fun social trading platform with real-time data." />
      <meta property="twitter:image" content="https://stoki-sigma.vercel.app/stoki-preview.png" />
    </>
  )
} 