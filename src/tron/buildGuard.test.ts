declare const global: any;
import { buildTrxTransfer, buildFreezeV2 } from './build';

const RPC = { primary: 'https://trongrid', fallback: [] };
const FROM = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';
const TO = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC';

describe('amount safe-number guard', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());

  it('rejects a TRX amount above MAX_SAFE_INTEGER instead of losing precision', async () => {
    global.fetch = jest.fn();
    const tooBig = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    await expect(buildTrxTransfer(RPC, FROM, TO, tooBig)).rejects.toThrow(/MAX_SAFE_INTEGER/);
    expect(global.fetch).not.toHaveBeenCalled(); // never hits the network with a corrupt amount
  });

  it('rejects a negative freeze amount', async () => {
    global.fetch = jest.fn();
    await expect(buildFreezeV2(RPC, FROM, -1n, 'ENERGY')).rejects.toThrow(/negative/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts a normal amount (sends as a JS number)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ txID: 'a', raw_data: {}, raw_data_hex: '0a', visible: true }) });
    await buildTrxTransfer(RPC, FROM, TO, 1000000n);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).amount).toBe(1000000);
  });
});
