/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
  },
  logging: {
    level: 'verbose',
    fetches: {
      fullUrl: true,
    },
  },
};

module.exports = nextConfig; 