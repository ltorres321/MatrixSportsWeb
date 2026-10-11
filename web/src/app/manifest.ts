import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Matrix Sports Analytics",
    short_name: "MatrixSports",
    description: "AI-simulated NFL win probabilities.",
    start_url: "/",
    display: "standalone",
    background_color: "#030603",
    theme_color: "#030603",
    icons: [
      {
        src: "/assets/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/assets/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
