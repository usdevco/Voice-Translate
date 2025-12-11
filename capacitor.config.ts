import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.usdevco.voicetranslate",
  appName: "LinguaFlow",
  // Vite build outputs client to dist/public (see script/build.ts)
  webDir: "dist/public",
  ios: {
    minVersion: "15.0",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
