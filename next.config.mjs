/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.SPLITFLOW_NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/dashboard", destination: "/", permanent: false },
      ...["groups", "analytics", "chat", "inbox", "proposals"].map((route) => ({
        source: `/${route}/:path*`, destination: `/demo/${route}/:path*`, permanent: false,
      })),
    ];
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
