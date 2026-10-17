import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs se usa solo en la ruta de exportación (servidor)
  serverExternalPackages: ["exceljs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
