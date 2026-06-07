import type { ReadOnlyChainAdapter, TokenRef } from './types';
import type { ChainConfig } from '../chain-registry/types';

const cfg: ChainConfig = {
  caip2: 'eip155:1', coinType: 60, family: 'evm', name: 'X', nativeSymbol: 'X',
  decimals: 18, rpc: { primary: 'https://x', fallback: [] }, explorerTx: 'https://x/',
  capabilities: { dapp: false, nft: false, defi: false },
};

// A stub that satisfies the interface — proves the shape compiles & is usable.
const stub: ReadOnlyChainAdapter = {
  config: cfg,
  deriveAddress: async () => '0xabc',
  validateAddress: () => true,
  getNativeBalance: async () => 0n,
  getTokenBalance: async (_a: string, _t: TokenRef) => 0n,
};

describe('ReadOnlyChainAdapter shape', () => {
  it('exposes config + 4 read methods', async () => {
    expect(stub.config.caip2).toBe('eip155:1');
    expect(stub.validateAddress('0xabc')).toBe(true);
    await expect(stub.getNativeBalance('0xabc')).resolves.toBe(0n);
    await expect(
      stub.getTokenBalance('0xabc', { address: '0xtok', decimals: 6 }),
    ).resolves.toBe(0n);
  });
});
