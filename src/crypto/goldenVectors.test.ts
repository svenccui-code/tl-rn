import { GOLDEN } from './goldenVectors';

describe('golden vectors', () => {
  it('uses the standard 12-word Trezor test mnemonic', () => {
    expect(GOLDEN.mnemonic.trim().split(/\s+/)).toHaveLength(12);
    expect(GOLDEN.mnemonic.trim().split(/\s+/).slice(-1)[0]).toBe('about');
  });

  it('pins the canonical EVM address (checksummed)', () => {
    expect(GOLDEN.evm.expectedAddress).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(GOLDEN.evm.path).toBe("m/44'/60'/0'/0/0");
    expect(GOLDEN.evm.coinType).toBe(60);
  });

  it('declares the TRON vector slot (value pinned post-verify)', () => {
    expect(GOLDEN.tron.path).toBe("m/44'/195'/0'/0/0");
    expect(GOLDEN.tron.coinType).toBe(195);
    expect(typeof GOLDEN.tron.expectedAddress).toBe('string');
  });
});
