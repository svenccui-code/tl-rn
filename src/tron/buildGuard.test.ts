import { buildTrxTransfer, buildFreezeV2 } from './build';

const FROM = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';
const TO = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC';
const fakeTw = (tb: any) => ({ transactionBuilder: tb } as any);

describe('amount safe-number guard', () => {
  it('rejects a TRX amount above MAX_SAFE_INTEGER instead of losing precision', async () => {
    const sendTrx = jest.fn();
    const tooBig = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    await expect(buildTrxTransfer(fakeTw({ sendTrx }), FROM, TO, tooBig)).rejects.toThrow(/MAX_SAFE_INTEGER/);
    expect(sendTrx).not.toHaveBeenCalled(); // never calls tronweb with a corrupt amount
  });

  it('rejects a negative freeze amount', async () => {
    const freezeBalanceV2 = jest.fn();
    await expect(buildFreezeV2(fakeTw({ freezeBalanceV2 }), FROM, -1n, 'ENERGY')).rejects.toThrow(/negative/);
    expect(freezeBalanceV2).not.toHaveBeenCalled();
  });

  it('accepts a normal amount (delegates to tronweb with JS number)', async () => {
    const sendTrx = jest.fn(async () => ({ txID: 'ok', raw_data: {}, raw_data_hex: '0a', visible: false }));
    await buildTrxTransfer(fakeTw({ sendTrx }), FROM, TO, 1000000n);
    expect(sendTrx).toHaveBeenCalledWith(TO, 1000000, FROM);
  });
});
