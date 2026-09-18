import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @plateforme/shared est du TypeScript source (pas pré-compilé) : Next doit
  // le transpiler comme le reste du code de l'app, pas le traiter comme un
  // paquet node_modules déjà buildé.
  transpilePackages: ["@plateforme/shared"],
};

export default nextConfig;
