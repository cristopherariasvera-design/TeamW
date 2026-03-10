module.exports = ({ config }) => {
  const isVercel = process.env.VERCEL === "1";

  return {
    ...config,
    name: "TeamWApp",
    slug: "TeamWApp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
    },
    web: {
      bundler: "metro",
      output: "single",
      // Si es Vercel usamos "/", si es GitHub Pages usamos "/TeamW"
      baseUrl: isVercel ? "/" : "/TeamW",
    },
    experiments: {
      typedRoutes: false,
      baseUrl: isVercel ? "/" : "/TeamW",
    },
    plugins: ["@react-native-community/datetimepicker"],
  };
};