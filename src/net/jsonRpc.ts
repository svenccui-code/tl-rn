import { Endpoints, httpJson, withFailover } from './http';

export async function jsonRpc(
  endpoints: Endpoints,
  method: string,
  params: unknown[],
): Promise<any> {
  return withFailover(endpoints, async base => {
    const r = await httpJson(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (r.error) throw new Error(`RPC ${method}: ${r.error.message ?? 'error'}`);
    return r.result;
  });
}
