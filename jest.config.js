module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  // Force Jest to exit after all tests complete, preventing async effects that
  // outlive the test (e.g. live network calls kicked off by App's useEffect)
  // from holding the process open or triggering "after teardown" log warnings.
  forceExit: true,
  // Allow @noble/hashes and react-native (ESM) to be transformed by Babel
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@noble)/)',
  ],
};
