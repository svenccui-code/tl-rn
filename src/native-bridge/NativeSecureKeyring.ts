import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type CreatedWallet = { walletRef: string; mnemonic: string };

// WalletRef = opaque handle/id, never contains a private key.
export interface Spec extends TurboModule {
  // Generate a brand-new HD wallet (fresh mnemonic) in native; mnemonic returned ONCE for backup.
  createWallet(): Promise<CreatedWallet>;
  // Import mnemonic, hold HDWallet in native memory, return a handle.
  importMnemonic(mnemonic: string): Promise<string>;
  // Forget the in-memory wallet for a handle.
  deleteWallet(walletRef: string): Promise<boolean>;
  // Read-only derivation (no private key out).
  deriveAddress(walletRef: string, coinType: number): Promise<string>;
  validateAddress(address: string, coinType: number): boolean;
  // Sign a 32-byte digest (hex, 0x-prefixed). Returns 0x-prefixed signature hex.
  // Covers the TRON universal-fallback path (architecture section 5 mode 2). Private key never leaves native.
  signHash(walletRef: string, coinType: number, digestHex: string): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('SecureKeyring');
