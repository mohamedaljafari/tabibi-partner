const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Use the virtual CSS module during production export; the file-system mode
  // can fail in clean CI/Vercel builds when Metro hashes the generated file.
  forceWriteFileSystem: false,
});
