import { eip1559SigningHash, assembleSignedEip1559, evmTxHash } from './tx';
import { EVM_GOLDEN } from './evmGolden';

describe('EVM tx (viem-backed)', () => {
  it('signing hash matches the golden', () => {
    expect(eip1559SigningHash(EVM_GOLDEN.tx)).toBe(EVM_GOLDEN.signingHash);
  });
  it('assembles the golden signed rawTx from the golden signature', () => {
    expect(assembleSignedEip1559(EVM_GOLDEN.tx, EVM_GOLDEN.signatureHex)).toBe(EVM_GOLDEN.signedRawTx);
  });
  it('computes the golden tx hash', () => {
    expect(evmTxHash(EVM_GOLDEN.signedRawTx)).toBe(EVM_GOLDEN.txHash);
  });
});
