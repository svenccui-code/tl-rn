import SecureKeyring from '../../native-bridge/NativeSecureKeyring';
import { bus } from '../bus/eventBus';
import { KeyringService } from './KeyringService';

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
