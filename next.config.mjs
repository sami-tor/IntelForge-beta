import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  compress: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  reactStrictMode: true,
  // Keep pg and related DB packages server-side only — never bundle for browser
  serverExternalPackages: ['pg', 'pg-pool', 'pg-protocol', 'pgpass', 'pg-connection-string', 'pdfkit'],
  webpack: (config, { isServer, webpack, dev }) => {
    if (!dev && !isServer) {
      config.devtool = false
    }

    // Prevent pg from being bundled client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
      }
    }
    
    if (isServer) {
      const stubPath = path.resolve(__dirname, 'src/lib/webpack-pg-native-stub.js')
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^pg-native$/,
          stubPath
        )
      )
    }
    
    return config
  },
}

export default nextConfig
