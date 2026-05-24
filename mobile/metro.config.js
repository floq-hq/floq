// Bundle .tflite model files as assets so `require('....tflite')` resolves.
// react-native-fast-tflite loads the model from the bundled asset.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('tflite');

module.exports = config;
