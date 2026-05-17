/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    PHAROS_PRICING_URL: process.env.PHAROS_PRICING_URL || "http://127.0.0.1:6910",
  },
};
export default nextConfig;
