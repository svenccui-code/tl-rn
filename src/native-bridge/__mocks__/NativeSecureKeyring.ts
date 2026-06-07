/**
 * Jest manual mock for NativeSecureKeyring.
 * Replaces TurboModuleRegistry.getEnforcing('SecureKeyring') so the module
 * can be imported in a Node/Jest environment without a real native module.
 */

const NativeSecureKeyring = {
  importMnemonic: jest.fn(async (_mnemonic: string): Promise<string> => 'mock-wallet-ref'),
  deleteWallet: jest.fn(async (_walletRef: string): Promise<boolean> => true),
  deriveAddress: jest.fn(async (_walletRef: string, _coinType: number): Promise<string> => '0xMockAddress'),
  validateAddress: jest.fn((_address: string, _coinType: number): boolean => true),
  signHash: jest.fn(async (_walletRef: string, _coinType: number, _digestHex: string): Promise<string> => '0xMockSignature'),
};

export default NativeSecureKeyring;
