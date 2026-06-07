import { buildEthereumProviderScript } from './provider-inject';

describe('buildEthereumProviderScript', () => {
  const s = buildEthereumProviderScript({ address: '0xabc', chainIdHex: '0x1' });
  it('defines window.ethereum with EIP-1193 surface', () => {
    expect(s).toContain('window.ethereum');
    expect(s).toContain('request');
    expect(s).toContain('eip6963:announceProvider');
    expect(s).toContain('isMetaMask');
  });
  it('embeds the injected address + chainId', () => {
    expect(s).toContain('0xabc');
    expect(s).toContain('0x1');
  });
});
