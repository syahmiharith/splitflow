/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.SPLITFLOW_NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
