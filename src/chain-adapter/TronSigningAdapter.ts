import type { ChainConfig } from '../chain-registry/types';
import { TronAdapter } from './TronAdapter';
import { makeTronWeb, buildTrxTransfer, buildTrc20Transfer, buildFreezeV2, buildVote, VoteEntry } from '../tron/build';
import { verifyTronTx, TronIntent } from '../tron/verify';
import { signTronTx, signTronTxMulti } from '../tron/sign';
import { broadcastTronTx } from '../tron/broadcast';
import type { TronUnsignedTx } from '../tron/types';

export class TronSigningAdapter extends TronAdapter {
  private rpc() { return this.config.rpc; }
  private tw() { return makeTronWeb(this.config.rpc); }

  // verify (security gate) -> sign local txID -> broadcast.
  private async signAndBroadcast(tx: TronUnsignedTx, walletRef: string, intent: TronIntent): Promise<string> {
    verifyTronTx(tx, intent);
    const signed = await signTronTx(tx, walletRef);
    return broadcastTronTx(this.rpc(), signed);
  }

  async sendTrx(walletRef: string, from: string, to: string, amountSun: bigint): Promise<string> {
    const tx = await buildTrxTransfer(this.tw(), from, to, amountSun);
    return this.signAndBroadcast(tx, walletRef, { owner: from, contractType: 'TransferContract', to, amount: amountSun });
  }

  async sendTrc20(walletRef: string, from: string, contract: string, to: string, amount: bigint): Promise<string> {
    const tx = await buildTrc20Transfer(this.tw(), from, contract, to, amount);
    // TRC-20 to/amount are inside the encoded contract data, not top-level params; verify owner + type only.
    return this.signAndBroadcast(tx, walletRef, { owner: from, contractType: 'TriggerSmartContract' });
  }

  async freeze(walletRef: string, from: string, frozenSun: bigint, resource: 'ENERGY' | 'BANDWIDTH'): Promise<string> {
    const tx = await buildFreezeV2(this.tw(), from, frozenSun, resource);
    return this.signAndBroadcast(tx, walletRef, { owner: from, contractType: 'FreezeBalanceV2Contract' });
  }

  async vote(walletRef: string, from: string, votes: VoteEntry[]): Promise<string> {
    const tx = await buildVote(this.tw(), from, votes);
    return this.signAndBroadcast(tx, walletRef, { owner: from, contractType: 'VoteWitnessContract' });
  }

  // Multisig: verify -> sign with N permission keys -> broadcast.
  async sendMultisig(tx: TronUnsignedTx, walletRefs: string[], intent: TronIntent): Promise<string> {
    verifyTronTx(tx, intent);
    const signed = await signTronTxMulti(tx, walletRefs);
    return broadcastTronTx(this.rpc(), signed);
  }
}

export function getTronSigningAdapter(config: ChainConfig): TronSigningAdapter {
  if (config.family === 'tron') return new TronSigningAdapter(config);
  throw new Error(`getTronSigningAdapter: not a tron chain: ${config.family}`);
}
