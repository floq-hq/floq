// Let TypeScript resolve `require('....tflite')`. Metro bundles these as assets
// (see metro.config.js); react-native-fast-tflite consumes the require() result.
declare module '*.tflite' {
  const asset: number;
  export = asset;
}
