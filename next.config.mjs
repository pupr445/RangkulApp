/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Cloudflare Pages tidak mendukung Next.js Image Optimization bawaan.
    // Gunakan Cloudflare Images / loader kustom saat siap produksi.
    unoptimized: true,
  },
};

export default nextConfig;
