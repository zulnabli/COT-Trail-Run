import { networkInterfaces } from 'node:os'

function isPrivateIPv4(address) {
  return (
    address.startsWith('10.') ||
    address.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  )
}

const allowedDevOrigins =
  process.env.NODE_ENV === 'development'
    ? [
        ...new Set(
          Object.values(networkInterfaces())
            .flatMap((entries) => entries ?? [])
            .filter((entry) => entry.family === 'IPv4' && !entry.internal && isPrivateIPv4(entry.address))
            .map((entry) => entry.address),
        ),
      ]
    : []

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
