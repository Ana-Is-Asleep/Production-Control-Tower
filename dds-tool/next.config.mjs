/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // lint runs in CI separately, don't block builds on it
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
