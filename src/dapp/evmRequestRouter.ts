import { jsonRpc } from '../net/jsonRpc';
import { ProviderRpcError } from '../evm/providerProtocol';
import type { TxRequest } from '../chain-adapter/signing-types';

export interface EvmDappContext {
  address: string;
  chainIdHex: string;
  config: { caip2: string; rpc: { primary: string; fallback: string[] } };
  walletRef: string;
  signTransaction: (req: TxRequest) => Promise<string>; // build+sign -> rawTx
  broadcast: (rawTx: string) => Promise<string>;
  personalSign: (message: string) => Promise<string>;
  confirm: (summary: string) => Promise<boolean>;
}

function hexToText(hex: string): string {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  let s = '';
  for (let i = 0; i < h.length; i += 2) s += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  return s;
}

export async function handleEvmRequest(method: string, params: any[], ctx: EvmDappContext): Promise<unknown> {
  switch (method) {
    case 'eth_requestAccounts':
    case 'eth_accounts':
      return [ctx.address];
    case 'eth_chainId':
      return ctx.chainIdHex;
    case 'net_version':
      return String(parseInt(ctx.chainIdHex, 16));
    case 'eth_sendTransaction': {
      const p = params[0] ?? {};
      const ok = await ctx.confirm(`Send ${p.value ?? '0x0'} to ${p.to}`);
      if (!ok) throw new ProviderRpcError(4001, 'User rejected the request');
      const raw = await ctx.signTransaction({
        from: ctx.address, to: p.to, value: BigInt(p.value ?? '0x0'), data: p.data ?? '0x',
        gasLimit: p.gas ? BigInt(p.gas) : undefined,
      });
      return ctx.broadcast(raw);
    }
    case 'personal_sign': {
      const data: string = params[0];
      const msg = data?.startsWith('0x') ? hexToText(data) : data;
      const ok = await ctx.confirm(`Sign message: ${msg}`);
      if (!ok) throw new ProviderRpcError(4001, 'User rejected the request');
      return ctx.personalSign(msg);
    }
    case 'eth_signTypedData_v4':
      throw new ProviderRpcError(4200, 'eth_signTypedData_v4 not supported yet (Phase 4)');
    default:
      return jsonRpc(ctx.config.rpc as any, method, params);
  }
}
