/** @type {import('next').NextConfig} */
const nextConfig = {
  rewrites: () => [
    {
      source: "/indexer/:call*",
      destination: "https://genesis.plopmenz.com/indexer/:call*",
    },
  ],
  reactStrictMode: true,
}

export default nextConfig
