import { useWalletStore } from './WalletStore';
import type { ChainAccount } from '../../multichain/accountTree';

describe('WalletStore', () => {
  beforeEach(() => useWalletStore.setState({ walletRef: undefined, accounts: [], locked: true }));
  it('sets the active wallet + account tree and unlocks', () => {
    const accts: ChainAccount[] = [{ caip2: 'eip155:1', name: 'Ethereum', address: '0xabc', nativeSymbol: 'ETH' }];
    useWalletStore.getState().setWallet('ref-1', accts);
    expect(useWalletStore.getState().walletRef).toBe('ref-1');
    expect(useWalletStore.getState().locked).toBe(false);
    expect(useWalletStore.getState().accounts).toHaveLength(1);
  });
  it('lock() clears the ref and re-locks', () => {
    useWalletStore.getState().setWallet('ref-1', []);
    useWalletStore.getState().lock();
    expect(useWalletStore.getState().walletRef).toBeUndefined();
    expect(useWalletStore.getState().locked).toBe(true);
  });
});
