import SecureKeyring from '../../native-bridge/NativeSecureKeyring';
import { bus } from '../bus/eventBus';
import { KeyringService } from './KeyringService';
import { useWalletStore } from '../stores/WalletStore';

describe('KeyringService', () => {
  it('imports a mnemonic via the bridge and emits wallet/added', async () => {
    (SecureKeyring.importMnemonic as jest.Mock).mockResolvedValue('ref-9');
    const emitted: any[] = [];
    const h = (p: any) => emitted.push(p);
    bus.on('wallet/added', h);
    const svc = new KeyringService();
    const ref = await svc.importMnemonic('abandon ... about');
    expect(ref).toBe('ref-9');
    expect(SecureKeyring.importMnemonic).toHaveBeenCalledWith('abandon ... about');
    expect(emitted).toEqual([{ walletRef: 'ref-9' }]);
    bus.off('wallet/added', h);
  });
});

describe('KeyringService.createWallet + finalizeWallet', () => {
  beforeEach(() => useWalletStore.setState({ walletRef: undefined, accounts: [], locked: true }));

  it('createWallet wraps the bridge and emits wallet/added', async () => {
    (SecureKeyring.createWallet as jest.Mock).mockResolvedValue({ walletRef: 'r1', mnemonic: 'm m m' });
    const emitted: any[] = [];
    const h = (p: any) => emitted.push(p);
    bus.on('wallet/added', h);
    const res = await new KeyringService().createWallet();
    expect(res).toEqual({ walletRef: 'r1', mnemonic: 'm m m' });
    expect(emitted).toEqual([{ walletRef: 'r1' }]);
    bus.off('wallet/added', h);
  });

  it('finalizeWallet builds the account tree and writes WalletStore', async () => {
    (SecureKeyring.deriveAddress as jest.Mock).mockImplementation(
      async (_ref: string, coinType: number) => (coinType === 60 ? '0xEVM' : 'TADDR'),
    );
    await new KeyringService().finalizeWallet('r1');
    const st = useWalletStore.getState();
    expect(st.walletRef).toBe('r1');
    expect(st.locked).toBe(false);
    expect(st.accounts.length).toBe(3);
  });
});
