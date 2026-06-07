import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { buildAccountTree } from './accountTree';
import { getAdapter } from '../chain-adapter/getAdapter';
import { getChain } from '../chain-registry/chains';

describe('getAdapter', () => {
  it('returns EvmAdapter for evm chains and TronAdapter for tron', () => {
    expect(getAdapter(getChain('eip155:1')!).constructor.name).toBe('EvmAdapter');
    expect(getAdapter(getChain('tron:728126428')!).constructor.name).toBe('TronAdapter');
  });
});

describe('buildAccountTree', () => {
  it('derives one entry per registered chain, EVM chains sharing one address', async () => {
    (SecureKeyring.deriveAddress as jest.Mock).mockImplementation(
      async (_ref: string, coinType: number) =>
        coinType === 60 ? '0x9858EfFD232B4033E47d90003D41EC34EcaEda94' : 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH',
    );
    const tree = await buildAccountTree('ref');
    expect(tree).toHaveLength(3);
    const eth = tree.find(t => t.caip2 === 'eip155:1')!;
    const bsc = tree.find(t => t.caip2 === 'eip155:56')!;
    const tron = tree.find(t => t.caip2 === 'tron:728126428')!;
    expect(eth.address).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(bsc.address).toBe(eth.address);            // EVM family shares the address
    expect(tron.address).toBe('TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH');
    expect(eth.nativeSymbol).toBe('ETH');
  });

  it('derives each coinType only once (EVM address reused across EVM chains)', async () => {
    (SecureKeyring.deriveAddress as jest.Mock).mockClear();
    (SecureKeyring.deriveAddress as jest.Mock).mockResolvedValue('0xaddr');
    await buildAccountTree('ref');
    const coinTypes = (SecureKeyring.deriveAddress as jest.Mock).mock.calls.map(c => c[1]).sort((a, b) => a - b);
    expect(coinTypes).toEqual([60, 195]); // 60 once (shared), 195 once — not 3 calls
  });
});
