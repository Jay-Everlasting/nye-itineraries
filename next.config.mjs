/** @type {import('next').NextConfig} */
const nextConfig = {
  // Itinerary content is rebuilt at most every 5 minutes; picks are read live
  // on the client. Keeps the site fast and alive even if Supabase is paused.
  experimental: { staleTimes: { dynamic: 30 } },
};
export default nextConfig;
