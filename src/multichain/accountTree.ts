import { CHAINS } from '../chain-registry/chains';
import { getAdapter } from '../chain-adapter/getAdapter';

export interface ChainAccount {
  caip2: string;
  name: string;
  address: string;
  nativeSymbol: string;
}

// Derive an address for every registered chain. Addresses are derived once per
// coinType (so all EVM chains reuse the single m/44'/60' address) and reused.
export async function buildAccountTree(walletRef: string): Promise<ChainAccount[]> {
  const byCoinType = new Map<number, Promise<string>>();
  const out: ChainAccount[] = [];
  for (const config of CHAINS) {
    let p = byCoinType.get(config.coinType);
    if (!p) {
      p = getAdapter(config).deriveAddress(walletRef);
      byCoinType.set(config.coinType, p);
    }
    out.push({
      caip2: config.caip2,
      name: config.name,
      address: await p,
      nativeSymbol: config.nativeSymbol,
    });
  }
  return out;
}
