declare const global: any;
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { TronAdapter } from './TronAdapter';
import type { ChainConfig } from '../chain-registry/types';

const TRON: ChainConfig = {
  caip2: 'tron:728126428', coinType: 195, family: 'tron', name: 'TRON', nativeSymbol: 'TRX',
  decimals: 6, rpc: { primary: 'https://trongrid', fallback: [] }, explorerTx: 'https://t/',
  capabilities: { dapp: true, nft: true, defi: true },
};
const ADDR = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';

describe('TronAdapter', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());

  it('derives via the bridge with coinType 195', async () => {
    (SecureKeyring.deriveAddress as jest.Mock).mockResolvedValue(ADDR);
    await expect(new TronAdapter(TRON).deriveAddress('ref')).resolves.toBe(ADDR);
    expect(SecureKeyring.deriveAddress).toHaveBeenCalledWith('ref', 195);
  });

  it('reads native TRX balance from /wallet/getaccount', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ balance: 12345678 }) });
    await expect(new TronAdapter(TRON).getNativeBalance(ADDR)).resolves.toBe(12345678n);
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('https://trongrid/wallet/getaccount');
    expect(JSON.parse(call[1].body)).toEqual({ address: ADDR, visible: true });
  });

  it('returns 0 for an unactivated account ({} response)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(new TronAdapter(TRON).getNativeBalance(ADDR)).resolves.toBe(0n);
  });

  it('reads a TRC20 balance from /v1/accounts', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ trc20: [{ 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t': '500000' }] }] }),
    });
    const bal = await new TronAdapter(TRON).getTokenBalance(ADDR, {
      address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6, symbol: 'USDT',
    });
    expect(bal).toBe(500000n);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(`https://trongrid/v1/accounts/${ADDR}`);
  });

  it('returns 0 when the token is absent', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ trc20: [] }] }) });
    await expect(
      new TronAdapter(TRON).getTokenBalance(ADDR, { address: 'TXxx', decimals: 6 }),
    ).resolves.toBe(0n);
  });
});
