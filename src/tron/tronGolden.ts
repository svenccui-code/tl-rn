export const TRON_GOLDEN = {
  // Real mainnet transaction pair (Task 1 Step 1). txID = sha256(raw_data_hex).
  // From https://api.trongrid.io/wallet/gettransactionbyid
  // Block: Latest confirmed mainnet block
  // Raw data hex (first 8 chars: 0a02dd15, last 8 chars: f6baea33)
  rawDataHex: '0a02dd152208b7d754229e74d93440d8b0fabaea335a65080112610a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412300a1541d9fcad10c484a9d1b8ea53325bb3ff666582bc7912154166749078ffe5ba0bba2973c2a5ac8778090a76c3180870c7f4f6baea33',
  txId: 'b6ee5bf45e08e7af57d0c7ba7f72b6675ac8472e2077963f2816ff3d944973a9',
  // Task 2: base58check address oracle (python base58 decode, checksum verified)
  // TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH -> 21-byte payload hex (0x41 prefix = TRON mainnet)
  addressHex: '41c8599111f29c1e1e061265b4af93ea1f274ad78a',
};
