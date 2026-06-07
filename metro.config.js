const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// Use polling when watchman is not available (e.g. CI environments).
const config = {
  resolver: {
    useWatchman: false,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
