/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.DIST_BUILD === '1' ? 'export' : undefined,
  trailingSlash: true,
  ...(process.env.DIST_BUILD === '1'
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: 'http://localhost:8000/api/:path*',
            },
          ]
        },
      }),
}
module.exports = nextConfig
