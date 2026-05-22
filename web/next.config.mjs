/** @type {import('next').NextConfig} */
// Static export for GitHub Pages. The site renders from a baked framework
// snapshot (lib/snapshot.ts) and links each market to Arcscan for live
// on-chain state. basePath = the project-pages subpath.
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: "/pharos",
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
