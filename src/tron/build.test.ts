declare const global: any;
import { buildTrxTransfer, buildTrc20Transfer, buildFreezeV2, buildVote } from './build';

const RPC = { primary: 'https://trongrid', fallback: [] };
const FROM = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';
const TO = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC';

describe('buildTrxTransfer', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());
  it('POSTs createtransaction with visible base58 + amount in sun', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ txID: 'abcd', raw_data: {}, raw_data_hex: '0a02', visible: true }) });
    const tx = await buildTrxTransfer(RPC, FROM, TO, 1000000n);
    expect(tx.txID).toBe('abcd');
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('https://trongrid/wallet/createtransaction');
    expect(JSON.parse(call[1].body)).toEqual({ owner_address: FROM, to_address: TO, amount: 1000000, visible: true });
  });
});

describe('buildTrc20Transfer', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());
  it('POSTs triggersmartcontract with transfer(address,uint256) param', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { result: true }, transaction: { txID: 'beef', raw_data: {}, raw_data_hex: '0a02', visible: true } }) });
    const usdt = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    const tx = await buildTrc20Transfer(RPC, FROM, usdt, TO, 5000000n);
    expect(tx.txID).toBe('beef');
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.function_selector).toBe('transfer(address,uint256)');
    expect(body.parameter).toMatch(/^0{24}[0-9a-f]{40}0{58}4c4b40$/); // 20-byte addr left-padded + amount 5_000_000=0x4c4b40
    expect(body.contract_address).toBe(usdt);
  });
});

describe('buildFreezeV2', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());
  it('POSTs freezebalancev2', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ txID: 'f1', raw_data: {}, raw_data_hex: '0a', visible: true }) });
    const tx = await buildFreezeV2(RPC, FROM, 1000000n, 'ENERGY');
    expect(tx.txID).toBe('f1');
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ owner_address: FROM, frozen_balance: 1000000, resource: 'ENERGY', visible: true });
  });
});

describe('buildVote', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());
  it('POSTs votewitnessaccount', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ txID: 'v1', raw_data: {}, raw_data_hex: '0a', visible: true }) });
    const tx = await buildVote(RPC, FROM, [{ srAddress: 'TSr', voteCount: 3 }]);
    expect(tx.txID).toBe('v1');
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).votes).toEqual([{ vote_address: 'TSr', vote_count: 3 }]);
  });
});
