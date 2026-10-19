import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera una web estática en out/ (index.html + una carpeta por página).
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
