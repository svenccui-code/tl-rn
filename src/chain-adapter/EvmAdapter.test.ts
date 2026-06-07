import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { EvmAdapter } from './EvmAdapter';
import type { ChainConfig } from '../chain-registry/types';

declare const global: any;

const ETH: ChainConfig = {
  caip2: 'eip155:1', coinType: 60, family: 'evm', name: 'Ethereum', nativeSymbol: 'ETH',
  decimals: 18, rpc: { primary: 'https://rpc', fallback: [] }, explorerTx: 'https://e/',
  capabilities: { dapp: true, nft: true, defi: true },
};

describe('EvmAdapter', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());

  it('derives the address via the bridge with coinType 60', async () => {
    (SecureKeyring.deriveAddress as jest.Mock).mockResolvedValue('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    const a = new EvmAdapter(ETH);
    await expect(a.deriveAddress('ref')).resolves.toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(SecureKeyring.deriveAddress).toHaveBeenCalledWith('ref', 60);
  });

  it('reads native balance via eth_getBalance', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: '0x0de0b6b3a7640000' }) });
    const a = new EvmAdapter(ETH);
    await expect(a.getNativeBalance('0xabc')).resolves.toBe(1000000000000000000n);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.method).toBe('eth_getBalance');
    expect(body.params).toEqual(['0xabc', 'latest']);
  });

  it('reads token balance via eth_call balanceOf', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: '0x0000000000000000000000000000000000000000000000000000000000000064' }) });
    const a = new EvmAdapter(ETH);
    const bal = await a.getTokenBalance('0x9858EfFD232B4033E47d90003D41EC34EcaEda94', { address: '0xToKeN', decimals: 6 });
    expect(bal).toBe(100n);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.method).toBe('eth_call');
    expect(body.params[0].to).toBe('0xToKeN');
    expect(body.params[0].data).toMatch(/^0x70a08231/);
  });

  it('validates addresses via the bridge', () => {
    (SecureKeyring.validateAddress as jest.Mock).mockReturnValue(true);
    expect(new EvmAdapter(ETH).validateAddress('0xabc')).toBe(true);
    expect(SecureKeyring.validateAddress).toHaveBeenCalledWith('0xabc', 60);
  });
});
