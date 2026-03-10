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
      // Si es Vercel, usamos la raíz, si no, la subcarpeta de GitHub Pages
      baseUrl: isVercel ? "/" : "/TeamW",
    },
    experiments: {
      typedRoutes: false,
    },
    plugins: ["@react-native-community/datetimepicker"],
  };
};