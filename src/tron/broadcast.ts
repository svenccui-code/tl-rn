import { httpJson, withFailover } from '../net/http';
import type { Endpoints, TronSignedTx } from './types';

export async function broadcastTronTx(rpc: Endpoints, signed: TronSignedTx): Promise<string> {
  const res = await withFailover(rpc, base =>
    httpJson(`${base}/wallet/broadcasttransaction`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(signed),
    }),
  );
  if (res?.result === true && res?.txid) return res.txid;
  throw new Error(`TRON broadcast failed: ${res?.code ?? ''} ${res?.message ?? JSON.stringify(res)}`);
}
