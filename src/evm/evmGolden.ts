import type { UnsignedEvmTx } from './tx';

// Golden EVM transaction for the standard test mnemonic (abandon...about), m/44'/60'.
// SIGNED_RAW / signature / txHash pinned from the ethers oracle (Task 4 Step 1).
export const EVM_GOLDEN = {
  from: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  tx: {
    chainId: 1n, nonce: 0n,
    maxPriorityFeePerGas: 1000000000n, maxFeePerGas: 20000000000n,
    gasLimit: 21000n, to: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    value: 1000000000000000n, data: '0x',
  } as UnsignedEvmTx,
  signingHash: '0x5798cced33015601eb042779e743a48d557048a70e41f998dadff5489712a67d',
  // signatureHex: 0x + r(32 bytes) + s(32 bytes) + yParity(1 byte), 65 bytes = 132 hex chars total
  signatureHex: '0x65a1f4ea4978d065bfbe115b7b3511b6e5c072cc380b3d03bb9ac815e158a731404f421ac43e0111550184e5288091598607c792306352cea3938689deb0378500',
  signedRawTx: '0x02f8720180843b9aca008504a817c800825208949858effd232b4033e47d90003d41ec34ecaeda9487038d7ea4c6800080c080a065a1f4ea4978d065bfbe115b7b3511b6e5c072cc380b3d03bb9ac815e158a731a0404f421ac43e0111550184e5288091598607c792306352cea3938689deb03785',
  txHash: '0x2ddd87964b8474515d3e707e1479dcd0e1f5286575a822eb16de7b9c1ef41584',
};
