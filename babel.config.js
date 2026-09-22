module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [["react-native-unistyles/plugin", {
      root: "src",
      autoProcessImports: [
        "@expo-base/accessibility",
        "@expo-base/components",
        "@expo-base/feedback",
        "@expo-base/i18n",
        "@expo-base/icons",
        "@expo-base/layouts",
        "@expo-base/media-presentation",
        "@expo-base/platform",
        "@expo-base/primitives",
        "@expo-base/tokens"
      ]
    }]],
  };
};
