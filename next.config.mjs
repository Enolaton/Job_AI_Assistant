/** @type {import('next').NextConfig} */
const nextConfig = {
    // Increase body size limit for all requests if possible
    experimental: {
        serverActions: {
            bodySizeLimit: '50mb',
        },
    },
};

export default nextConfig;
