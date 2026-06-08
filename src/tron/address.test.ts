import { tronAddressToHex, hexToTronAddress } from './address';
import { TRON_GOLDEN } from './tronGolden';

const ADDR = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';

describe('tron address', () => {
  it('decodes base58 to 41-prefixed hex (golden)', () => {
    expect(tronAddressToHex(ADDR)).toBe(TRON_GOLDEN.addressHex);
  });
  it('golden hex starts with 41 and is 42 chars', () => {
    expect(TRON_GOLDEN.addressHex).toMatch(/^41[0-9a-f]{40}$/);
  });
  it('round-trips hex -> base58', () => {
    expect(hexToTronAddress(tronAddressToHex(ADDR))).toBe(ADDR);
  });
  it('rejects a corrupted address (bad checksum)', () => {
    expect(() => tronAddressToHex('TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdX')).toThrow();
  });
});
