import { CHAINS, getChain, chainsByFamily } from './chains';

describe('chain registry', () => {
  it('contains TRON, Ethereum and BSC', () => {
    expect(CHAINS.map(c => c.caip2).sort()).toEqual(
      ['eip155:1', 'eip155:56', 'tron:728126428'].sort(),
    );
  });

  it('looks up a chain by caip2', () => {
    expect(getChain('eip155:1')?.nativeSymbol).toBe('ETH');
    expect(getChain('tron:728126428')?.coinType).toBe(195);
    expect(getChain('nope')).toBeUndefined();
  });

  it('groups EVM chains (all share coinType 60)', () => {
    const evm = chainsByFamily('evm');
    expect(evm.length).toBe(2);
    expect(evm.every(c => c.coinType === 60)).toBe(true);
  });

  it('every chain has primary rpc + explorer + decimals', () => {
    for (const c of CHAINS) {
      expect(c.rpc.primary).toMatch(/^https:\/\//);
      expect(c.explorerTx).toMatch(/^https:\/\//);
      expect(c.decimals).toBeGreaterThan(0);
    }
  });
});
