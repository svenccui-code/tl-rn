import { buildTrxTransfer, buildTrc20Transfer, buildFreezeV2, buildVote } from './build';

const FROM = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';
const TO = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC';
const fakeTw = (tb: any) => ({ transactionBuilder: tb } as any);

describe('buildTrxTransfer (tronweb)', () => {
  it('delegates to transactionBuilder.sendTrx(to, amount, from)', async () => {
    const sendTrx = jest.fn(async () => ({ txID: 'abc', raw_data: {}, raw_data_hex: '0a02', visible: false }));
    const tx = await buildTrxTransfer(fakeTw({ sendTrx }), FROM, TO, 1000000n);
    expect(sendTrx).toHaveBeenCalledWith(TO, 1000000, FROM);
    expect(tx.txID).toBe('abc');
  });
  it('rejects amounts above MAX_SAFE_INTEGER', async () => {
    const sendTrx = jest.fn();
    await expect(buildTrxTransfer(fakeTw({ sendTrx }), FROM, TO, BigInt(Number.MAX_SAFE_INTEGER) + 1n)).rejects.toThrow(/MAX_SAFE_INTEGER/);
    expect(sendTrx).not.toHaveBeenCalled();
  });
});

describe('buildTrc20Transfer (tronweb)', () => {
  it('delegates to triggerSmartContract transfer(address,uint256) and unwraps .transaction', async () => {
    const triggerSmartContract = jest.fn(async () => ({
      transaction: { txID: 'beef', raw_data: {}, raw_data_hex: '0a', visible: false },
      result: { result: true },
    }));
    const usdt = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    const tx = await buildTrc20Transfer(fakeTw({ triggerSmartContract }), FROM, usdt, TO, 5000000n);
    expect(tx.txID).toBe('beef');
    const args = triggerSmartContract.mock.calls[0] as any[];
    expect(args[0]).toBe(usdt);
    expect(args[1]).toBe('transfer(address,uint256)');
    expect(args[3]).toEqual([{ type: 'address', value: TO }, { type: 'uint256', value: '5000000' }]);
    expect(args[4]).toBe(FROM);
  });
});

describe('buildFreezeV2 / buildVote (tronweb)', () => {
  it('freezeBalanceV2(amount, resource, owner)', async () => {
    const freezeBalanceV2 = jest.fn(async () => ({ txID: 'f1', raw_data: {}, raw_data_hex: '0a', visible: false }));
    const tx = await buildFreezeV2(fakeTw({ freezeBalanceV2 }), FROM, 1000000n, 'ENERGY');
    expect(freezeBalanceV2).toHaveBeenCalledWith(1000000, 'ENERGY', FROM);
    expect(tx.txID).toBe('f1');
  });
  it('vote({sr: count}, owner)', async () => {
    const vote = jest.fn(async () => ({ txID: 'v1', raw_data: {}, raw_data_hex: '0a', visible: false }));
    const tx = await buildVote(fakeTw({ vote }), FROM, [{ srAddress: 'TSr', voteCount: 3 }]);
    expect(vote).toHaveBeenCalledWith({ TSr: 3 }, FROM);
    expect(tx.txID).toBe('v1');
  });
});
