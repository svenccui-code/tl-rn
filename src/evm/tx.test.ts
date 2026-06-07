import { encodeUnsignedEip1559, eip1559SigningHash, UnsignedEvmTx } from './tx';
import { hexToBytes, bytesToHex } from '../crypto/bytes';

const TX: UnsignedEvmTx = {
  chainId: 1n, nonce: 0n,
  maxPriorityFeePerGas: 1000000000n, maxFeePerGas: 20000000000n,
  gasLimit: 21000n, to: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  value: 1000000000000000n, data: '0x',
};

describe('EIP-1559 encode', () => {
  it('prefixes the envelope with 0x02', () => {
    expect(bytesToHex(encodeUnsignedEip1559(TX)).startsWith('0x02')).toBe(true);
  });
  it('signing hash is 32 bytes', () => {
    expect(hexToBytes(eip1559SigningHash(TX)).length).toBe(32);
  });
  it('matches the ethers-derived signing hash', () => {
    expect(eip1559SigningHash(TX)).toBe('0x5798cced33015601eb042779e743a48d557048a70e41f998dadff5489712a67d');
  });
});
