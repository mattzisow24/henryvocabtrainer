import type { MetadataRoute } from "next";
import { LEARNER_NAME } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${LEARNER_NAME}'s SAT Vocab`,
    short_name: "SAT Vocab",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f3f8",
    theme_color: "#f1f3f8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
