// Single source of truth for Phase-0 golden vectors.
// TRON address + signature are pinned in a later task after cross-checking the real TronLink wallet (architecture §7).

export const GOLDEN = {
  mnemonic:
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',

  // Digest to sign for the signature golden vector: sha256("tronlink-rn golden vector").
  // Hex value is pinned in a later task.
  signDigestHex: '0x0910c572a405945ea75ed966cec498d9a65abe9882a6563687fea7fa94bba3aa', // sha256("tronlink-rn golden vector")

  evm: {
    path: "m/44'/60'/0'/0/0",
    coinType: 60, // TWCore CoinType.ethereum
    expectedAddress: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  },

  tron: {
    path: "m/44'/195'/0'/0/0",
    coinType: 195, // TWCore CoinType.tron
    expectedAddress: 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH', // derived from TWCore 4.6.13, cross-check pending
    expectedSignatureHex: '0x356af5e73bb4d7de750d128c1d626eac6ffa5ac951aba32ea1db83b81ab01d1a728f9693dfe716dabfa59720f15ecd5b3c7cf8d407288691965d269a3528cfd500', // ECDSA secp256k1 over sha256("tronlink-rn golden vector")
  },
} as const;
