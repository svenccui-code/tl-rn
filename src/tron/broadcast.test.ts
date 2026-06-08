declare const global: any;
import { broadcastTronTx } from './broadcast';

const RPC = { primary: 'https://trongrid', fallback: [] };
const signed = { txID: 'abcd', raw_data: {}, raw_data_hex: '0a02', visible: true, signature: ['ab'] };

describe('broadcastTronTx', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());
  it('POSTs the signed tx and returns the txid on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: true, txid: 'abcd' }) });
    await expect(broadcastTronTx(RPC, signed as any)).resolves.toBe('abcd');
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('https://trongrid/wallet/broadcasttransaction');
    expect(JSON.parse(call[1].body).signature).toEqual(['ab']);
  });
  it('throws on a failed broadcast', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: false, code: 'SIGERROR', message: '6261' }) });
    await expect(broadcastTronTx(RPC, signed as any)).rejects.toThrow(/SIGERROR|broadcast/i);
  });
});
