import { useNetworkStore } from './NetworkStore';

describe('NetworkStore', () => {
  beforeEach(() => useNetworkStore.setState({ selectedCaip2: 'tron:728126428', nodeByChain: {} }));
  it('defaults to TRON mainnet', () => {
    expect(useNetworkStore.getState().selectedCaip2).toBe('tron:728126428');
  });
  it('switches chain and sets per-chain node', () => {
    useNetworkStore.getState().setChain('eip155:1');
    useNetworkStore.getState().setNode('eip155:1', 'https://rpc');
    expect(useNetworkStore.getState().selectedCaip2).toBe('eip155:1');
    expect(useNetworkStore.getState().nodeByChain['eip155:1']).toBe('https://rpc');
  });
});
