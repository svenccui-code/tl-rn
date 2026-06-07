import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import type { ChainConfig } from '../chain-registry/types';
import { jsonRpc } from '../net/jsonRpc';
import { EvmAdapter } from './EvmAdapter';
import type { SigningChainAdapter, TxRequest } from './signing-types';
import { assembleSignedEip1559, eip1559SigningHash, UnsignedEvmTx } from '../evm/tx';
import { personalSignHash, toEthSignatureV } from '../evm/message';

export class EvmSigningAdapter extends EvmAdapter implements SigningChainAdapter {
  private chainId(): bigint { return BigInt(this.config.caip2.split(':')[1]); }

  async buildTransaction(req: TxRequest): Promise<UnsignedEvmTx> {
    const nonceHex = await jsonRpc(this.config.rpc, 'eth_getTransactionCount', [req.from, 'pending']);
    const priorityHex = await jsonRpc(this.config.rpc, 'eth_maxPriorityFeePerGas', []).catch(() => '0x3b9aca00');
    const block = await jsonRpc(this.config.rpc, 'eth_getBlockByNumber', ['latest', false]);
    const baseFee = BigInt(block?.baseFeePerGas ?? '0x0');
    const maxPriorityFeePerGas = BigInt(priorityHex);
    const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
    const gasLimit = req.gasLimit ?? (req.data && req.data !== '0x'
      ? BigInt(await jsonRpc(this.config.rpc, 'eth_estimateGas', [{ from: req.from, to: req.to, value: '0x' + req.value.toString(16), data: req.data }]))
      : 21000n);
    return {
      chainId: this.chainId(),
      nonce: BigInt(nonceHex),
      maxPriorityFeePerGas, maxFeePerGas, gasLimit,
      to: req.to, value: req.value, data: req.data ?? '0x',
    };
  }

  async sign(tx: UnsignedEvmTx, walletRef: string): Promise<string> {
    const hash = eip1559SigningHash(tx);
    const signatureHex = await SecureKeyring.signHash(walletRef, this.config.coinType, hash);
    return assembleSignedEip1559(tx, signatureHex);
  }

  async broadcast(signedRawTx: string): Promise<string> {
    return jsonRpc(this.config.rpc, 'eth_sendRawTransaction', [signedRawTx]);
  }

  async personalSign(message: string, walletRef: string): Promise<string> {
    const sig = await SecureKeyring.signHash(walletRef, this.config.coinType, personalSignHash(message));
    return toEthSignatureV(sig);
  }
}

export function getSigningAdapter(config: ChainConfig): SigningChainAdapter {
  if (config.family === 'evm') return new EvmSigningAdapter(config);
  throw new Error(`no signing adapter yet for family: ${config.family}`); // TRON = Phase 3
}
