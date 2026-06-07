import { keccak256 } from './keccak';

describe('keccak256', () => {
  it('hashes empty input to the known constant', () => {
    expect(keccak256('0x')).toBe('0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  });
  it('accepts bytes', () => {
    expect(keccak256(new Uint8Array([]))).toBe('0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  });
});
