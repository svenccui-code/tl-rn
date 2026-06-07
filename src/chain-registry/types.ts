export type Caip2 = string;            // 'eip155:1' | 'tron:728126428'
export type ChainFamily = 'evm' | 'tron';

export interface ChainConfig {
  caip2: Caip2;
  coinType: number;                    // TWCore CoinType: 60 (EVM) | 195 (TRON)
  family: ChainFamily;                 // selects the adapter
  name: string;
  nativeSymbol: string;
  decimals: number;
  rpc: { primary: string; fallback: string[] };
  explorerTx: string;                  // base url; append tx hash
  capabilities: { dapp: boolean; nft: boolean; defi: boolean };
}
