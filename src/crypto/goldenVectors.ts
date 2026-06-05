// Single source of truth for Phase-0 golden vectors.
// TRON address + signature are pinned in a later task after cross-checking the real TronLink wallet (architecture §7).

export const GOLDEN = {
  mnemonic:
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',

  // Digest to sign for the signature golden vector: sha256("tronlink-rn golden vector").
  // Hex value is pinned in a later task.
  signDigestHex: '', // PIN IN TASK 3

  evm: {
    path: "m/44'/60'/0'/0/0",
    coinType: 60, // TWCore CoinType.ethereum
    expectedAddress: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  },

  tron: {
    path: "m/44'/195'/0'/0/0",
    coinType: 195, // TWCore CoinType.tron
    expectedAddress: '', // PIN IN TASK 3 (cross-checked vs existing TronLink)
    expectedSignatureHex: '', // PIN IN TASK 3
  },
} as const;
