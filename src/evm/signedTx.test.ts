import { assembleSignedEip1559, evmTxHash } from './tx';
import { EVM_GOLDEN } from './evmGolden';

describe('assembleSignedEip1559', () => {
  it('reproduces the ethers golden signed rawTx', () => {
    expect(assembleSignedEip1559(EVM_GOLDEN.tx, EVM_GOLDEN.signatureHex)).toBe(EVM_GOLDEN.signedRawTx);
  });
  it('computes the matching tx hash', () => {
    expect(evmTxHash(EVM_GOLDEN.signedRawTx)).toBe(EVM_GOLDEN.txHash);
  });
});
