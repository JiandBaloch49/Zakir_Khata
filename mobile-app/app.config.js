module.exports = {
  expo: {
    name: "DigiKhata",
    slug: "digikhata-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#00A651"
    },
    assetBundlePatterns: [
      "assets/icon.png",
      "assets/splash.png",
      "assets/adaptive-icon.png",
      "assets/favicon.png"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.digikhata.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#00A651"
      },
      package: "com.digikhata.app",
      googleServicesFile: "./google-services.json"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [],
    extra: {
      eas: {
        projectId: "b817f3e3-dc43-43c4-aef6-d6676ceda7b0"
      },
      firebaseApiKey: process.env.FIREBASE_API_KEY || '',
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      firebaseAppId: process.env.FIREBASE_APP_ID || '',
    },
  },
};