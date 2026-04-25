import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Autoriser les requêtes cross-origin depuis le domaine en dev
  allowedDevOrigins: [
    "lesbonsplombiers.pixfeed.net",
  ],
  
  // Configuration de l'API backend
  env: {
    NEXT_PUBLIC_API_URL: "https://api-lesbonsplombiers.pixfeed.net",
  },
};

export default nextConfig;
