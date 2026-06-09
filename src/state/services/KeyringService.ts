import SecureKeyring from '../../native-bridge/NativeSecureKeyring';
import { bus } from '../bus/eventBus';
import { buildAccountTree } from '../../multichain/accountTree';
import { useWalletStore } from '../stores/WalletStore';

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

  async createWallet(): Promise<{ walletRef: string; mnemonic: string }> {
    const res = await SecureKeyring.createWallet();
    bus.emit('wallet/added', { walletRef: res.walletRef });
    return res;
  }

  // Build the account tree for a wallet handle and make it the active (unlocked) wallet.
  async finalizeWallet(walletRef: string): Promise<void> {
    const accounts = await buildAccountTree(walletRef);
    useWalletStore.getState().setWallet(walletRef, accounts);
  }
}
