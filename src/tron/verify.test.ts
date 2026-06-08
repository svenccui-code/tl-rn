import { verifyTronTx } from './verify';
import { TRON_GOLDEN } from './tronGolden';

const tx = (rawHex: string, txId: string, type: string, value: any) => ({
  txID: txId, raw_data_hex: rawHex, visible: true,
  raw_data: { contract: [{ type, parameter: { value } }] },
});

describe('verifyTronTx', () => {
  it('passes for a matching TransferContract', () => {
    const t = tx(TRON_GOLDEN.rawDataHex, TRON_GOLDEN.txId, 'TransferContract', { owner_address: 'TFrom', to_address: 'TTo', amount: 5 });
    expect(() => verifyTronTx(t as any, { owner: 'TFrom', contractType: 'TransferContract', to: 'TTo', amount: 5 })).not.toThrow();
  });
  it('throws on txID mismatch (tampered node)', () => {
    const t = tx(TRON_GOLDEN.rawDataHex, 'deadbeef'.padEnd(64, '0'), 'TransferContract', { owner_address: 'TFrom' });
    expect(() => verifyTronTx(t as any, { owner: 'TFrom', contractType: 'TransferContract' })).toThrow(/txID/i);
  });
  it('throws on contract-type mismatch', () => {
    const t = tx(TRON_GOLDEN.rawDataHex, TRON_GOLDEN.txId, 'TriggerSmartContract', { owner_address: 'TFrom' });
    expect(() => verifyTronTx(t as any, { owner: 'TFrom', contractType: 'TransferContract' })).toThrow(/contract type/i);
  });
  it('throws when more than one contract is present', () => {
    const t: any = tx(TRON_GOLDEN.rawDataHex, TRON_GOLDEN.txId, 'TransferContract', { owner_address: 'TFrom' });
    t.raw_data.contract.push({ type: 'TransferContract', parameter: { value: {} } });
    expect(() => verifyTronTx(t, { owner: 'TFrom', contractType: 'TransferContract' })).toThrow(/exactly 1 contract/i);
  });
  it('fail-closed: throws when requested `to` is absent from the tx', () => {
    const t = tx(TRON_GOLDEN.rawDataHex, TRON_GOLDEN.txId, 'TransferContract', { owner_address: 'TFrom' /* no to_address */ });
    expect(() => verifyTronTx(t as any, { owner: 'TFrom', contractType: 'TransferContract', to: 'TTo' })).toThrow(/to mismatch/i);
  });
  it('throws on intent owner mismatch', () => {
    const t = tx(TRON_GOLDEN.rawDataHex, TRON_GOLDEN.txId, 'TransferContract', { owner_address: 'TEvil' });
    expect(() => verifyTronTx(t as any, { owner: 'TFrom', contractType: 'TransferContract' })).toThrow(/owner mismatch/i);
  });
});
