import { verifyTronTx } from './verify';
import { TRON_GOLDEN } from './tronGolden';

const tx = (rawHex: string, txId: string, params: any) => ({
  txID: txId, raw_data_hex: rawHex, visible: true,
  raw_data: { contract: [{ parameter: { value: params } }] },
});

describe('verifyTronTx', () => {
  it('passes when txID == sha256(raw_data_hex) and intent matches', () => {
    const t = tx(TRON_GOLDEN.rawDataHex, TRON_GOLDEN.txId, { owner_address: 'TFrom', to_address: 'TTo', amount: 5 });
    expect(() => verifyTronTx(t as any, { owner: 'TFrom', to: 'TTo', amount: 5 })).not.toThrow();
  });
  it('throws when txID does not match sha256(raw_data_hex) (tampered node)', () => {
    const t = tx(TRON_GOLDEN.rawDataHex, 'deadbeef'.padEnd(64, '0'), {});
    expect(() => verifyTronTx(t as any, {})).toThrow(/txID/i);
  });
  it('throws when the decoded intent does not match the request', () => {
    const t = tx(TRON_GOLDEN.rawDataHex, TRON_GOLDEN.txId, { owner_address: 'TFrom', to_address: 'TEvil', amount: 5 });
    expect(() => verifyTronTx(t as any, { owner: 'TFrom', to: 'TTo', amount: 5 })).toThrow(/intent|to/i);
  });
});
