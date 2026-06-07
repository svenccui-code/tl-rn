import { personalSignHash, toEthSignatureV } from './message';

describe('personal_sign', () => {
  it('computes the EIP-191 prefixed hash (ethers parity)', () => {
    expect(personalSignHash('hello tronlink')).toBe(
      '0x6495cba28229a9ceacf34bb1ac9e04b91631b30f95c00436abd57bc564fbaab7'
    );
  });
  it('converts a 65-byte 0/1 yParity signature to v=27/28', () => {
    const sig = '0x' + 'ab'.repeat(32) + 'cd'.repeat(32) + '00';
    expect(toEthSignatureV(sig).endsWith('1b')).toBe(true); // 27
    const sig1 = '0x' + 'ab'.repeat(32) + 'cd'.repeat(32) + '01';
    expect(toEthSignatureV(sig1).endsWith('1c')).toBe(true); // 28
  });
});
