import { tronTxId } from './txId';
import { TRON_GOLDEN } from './tronGolden';

describe('tronTxId', () => {
  it('reproduces a real mainnet txID = sha256(raw_data_hex)', () => {
    expect(tronTxId(TRON_GOLDEN.rawDataHex)).toBe(TRON_GOLDEN.txId);
  });
  it('is lowercase bare hex without 0x prefix', () => {
    expect(tronTxId(TRON_GOLDEN.rawDataHex)).toMatch(/^[0-9a-f]{64}$/);
  });
});
