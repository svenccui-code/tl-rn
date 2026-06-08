import { useAssetsStore } from '../stores/AssetsStore';
import { BalanceService } from './BalanceService';

describe('BalanceService', () => {
  beforeEach(() => useAssetsStore.setState({ nativeBalance: {} }));
  it('reads via the injected adapter factory and writes AssetsStore', async () => {
    const adapter = { getNativeBalance: jest.fn(async () => 42n) } as any;
    const svc = new BalanceService(() => adapter);
    await svc.refreshNative('eip155:1', '0xabc');
    expect(adapter.getNativeBalance).toHaveBeenCalledWith('0xabc');
    expect(useAssetsStore.getState().nativeBalance['eip155:1:0xabc']).toBe(42n);
  });
});
