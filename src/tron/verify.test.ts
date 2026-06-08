import { verifyTronTx } from './verify';
import { TRON_GOLDEN } from './tronGolden';

describe('verifyTronTx (integrity; raw_data built client-side via tronweb)', () => {
  it('passes when txID == sha256(raw_data_hex)', () => {
    const tx = { txID: TRON_GOLDEN.txId, raw_data: {}, raw_data_hex: TRON_GOLDEN.rawDataHex, visible: false };
    expect(() => verifyTronTx(tx as any)).not.toThrow();
  });
  it('SECURITY: throws when txID != sha256(raw_data_hex) (tampered tx object)', () => {
    const tx = { txID: 'dead'.padEnd(64, '0'), raw_data: {}, raw_data_hex: TRON_GOLDEN.rawDataHex, visible: false };
    expect(() => verifyTronTx(tx as any)).toThrow(/txID/i);
  });
  it('throws on a malformed tx (missing raw_data_hex)', () => {
    expect(() => verifyTronTx({ txID: 'x' } as any)).toThrow(/malformed/i);
  });
});
