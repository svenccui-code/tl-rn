import type { ChainConfig } from '../chain-registry/types';
import { TronAdapter } from './TronAdapter';
import { makeTronWeb, buildTrxTransfer, buildTrc20Transfer, buildFreezeV2, buildVote, VoteEntry } from '../tron/build';
import { verifyTronTx } from '../tron/verify';
import { signTronTx, signTronTxMulti } from '../tron/sign';
import { broadcastTronTx } from '../tron/broadcast';
import type { TronUnsignedTx } from '../tron/types';

export class TronSigningAdapter extends TronAdapter {
  private rpc() { return this.config.rpc; }
  private tw() { return makeTronWeb(this.config.rpc); }

  // verify integrity (txID == sha256(raw_data_hex)) -> sign local txID -> broadcast.
  private async signAndBroadcast(tx: TronUnsignedTx, walletRef: string): Promise<string> {
    verifyTronTx(tx);
    const signed = await signTronTx(tx, walletRef);
    return broadcastTronTx(this.rpc(), signed);
  }

  async sendTrx(walletRef: string, from: string, to: string, amountSun: bigint): Promise<string> {
    const tx = await buildTrxTransfer(this.tw(), from, to, amountSun);
    return this.signAndBroadcast(tx, walletRef);
  }

  async sendTrc20(walletRef: string, from: string, contract: string, to: string, amount: bigint): Promise<string> {
    const tx = await buildTrc20Transfer(this.tw(), from, contract, to, amount);
    return this.signAndBroadcast(tx, walletRef);
  }

  async freeze(walletRef: string, from: string, frozenSun: bigint, resource: 'ENERGY' | 'BANDWIDTH'): Promise<string> {
    const tx = await buildFreezeV2(this.tw(), from, frozenSun, resource);
    return this.signAndBroadcast(tx, walletRef);
  }

  async vote(walletRef: string, from: string, votes: VoteEntry[]): Promise<string> {
    const tx = await buildVote(this.tw(), from, votes);
    return this.signAndBroadcast(tx, walletRef);
  }

  // Multisig: verify integrity -> sign with N permission keys -> broadcast.
  async sendMultisig(tx: TronUnsignedTx, walletRefs: string[]): Promise<string> {
    verifyTronTx(tx);
    const signed = await signTronTxMulti(tx, walletRefs);
    return broadcastTronTx(this.rpc(), signed);
  }
}

export function getTronSigningAdapter(config: ChainConfig): TronSigningAdapter {
  if (config.family === 'tron') return new TronSigningAdapter(config);
  throw new Error(`getTronSigningAdapter: not a tron chain: ${config.family}`);
}
