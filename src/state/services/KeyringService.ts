import SecureKeyring from '../../native-bridge/NativeSecureKeyring';
import { bus } from '../bus/eventBus';

// The ONLY orchestration wrapper around the native bridge for wallet lifecycle/derivation.
// Signing is NOT here — it stays in chain-adapter -> SecureKeyring.signHash.
export class KeyringService {
  async importMnemonic(mnemonic: string): Promise<string> {
    const walletRef = await SecureKeyring.importMnemonic(mnemonic);
    bus.emit('wallet/added', { walletRef });
    return walletRef;
  }
  deriveAddress(walletRef: string, coinType: number): Promise<string> {
    return SecureKeyring.deriveAddress(walletRef, coinType);
  }
  deleteWallet(walletRef: string): Promise<boolean> {
    return SecureKeyring.deleteWallet(walletRef);
  }
}
