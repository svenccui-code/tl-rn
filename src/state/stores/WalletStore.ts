import { create } from 'zustand';
import type { ChainAccount } from '../../multichain/accountTree';

interface WalletState {
  walletRef?: string;
  accounts: ChainAccount[];
  locked: boolean;
  setWallet(walletRef: string, accounts: ChainAccount[]): void;
  lock(): void;
}

export const useWalletStore = create<WalletState>((set) => ({
  walletRef: undefined,
  accounts: [],
  locked: true,
  setWallet: (walletRef, accounts) => set({ walletRef, accounts, locked: false }),
  lock: () => set({ walletRef: undefined, locked: true }),
}));
