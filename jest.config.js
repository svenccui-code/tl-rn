module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  // Reset mock call history between tests so not.toHaveBeenCalled() assertions
  // are not polluted by invocations from a previous test case.
  clearMocks: true,
  // Force Jest to exit after all tests complete, preventing async effects that
  // outlive the test (e.g. live network calls kicked off by App's useEffect)
  // from holding the process open or triggering "after teardown" log warnings.
  forceExit: true,
  // Disable watchman to avoid socket errors
  watchman: false,
  // Allow @noble/hashes and react-native (ESM) to be transformed by Babel
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@noble|@react-navigation)/)',
  ],
};
