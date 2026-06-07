// Global Jest setup: mock native modules that are unavailable in the Node test environment.
jest.mock('./src/native-bridge/NativeSecureKeyring');
