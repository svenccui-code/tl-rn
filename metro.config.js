const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// Use polling when watchman is not available (e.g. CI environments).
// extraNodeModules provides browser-compatible shims for Node built-ins used
// by tronweb and other dependencies in the Hermes/Metro bundle.
const config = {
  resolver: {
    useWatchman: false,
    extraNodeModules: {
      buffer: require.resolve('buffer'),
      stream: require.resolve('stream-browserify'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
