import { erc20BalanceOfData, decodeUint256 } from './abi';

describe('erc20BalanceOfData', () => {
  it('encodes selector + left-padded address', () => {
    const data = erc20BalanceOfData('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(data).toBe(
      '0x70a08231' +
      '000000000000000000000000' +
      '9858effd232b4033e47d90003d41ec34ecaeda94',
    );
    expect(data.length).toBe(2 + 8 + 64); // 0x + selector + 32-byte word
  });

  it('rejects malformed addresses', () => {
    expect(() => erc20BalanceOfData('0x1234')).toThrow();
  });
});

describe('decodeUint256', () => {
  it('decodes hex to bigint', () => {
    expect(decodeUint256('0x0de0b6b3a7640000')).toBe(1000000000000000000n);
  });
  it('treats empty/0x as zero', () => {
    expect(decodeUint256('0x')).toBe(0n);
    expect(decodeUint256('')).toBe(0n);
  });
});
