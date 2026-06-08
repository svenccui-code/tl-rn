import { useAssetsStore } from './AssetsStore';

describe('AssetsStore', () => {
  beforeEach(() => useAssetsStore.setState({ nativeBalance: {} }));
  it('stores native balance keyed by caip2:address (bigint)', () => {
    useAssetsStore.getState().setNativeBalance('eip155:1', '0xabc', 1000000000000000000n);
    expect(useAssetsStore.getState().nativeBalance['eip155:1:0xabc']).toBe(1000000000000000000n);
  });
});
