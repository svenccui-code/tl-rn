import { httpJson, withFailover } from '../net/http';
import { tronAddressToHex } from './address';
import type { Endpoints, TronUnsignedTx } from './types';

async function post(rpc: Endpoints, path: string, body: any): Promise<any> {
  return withFailover(rpc, base =>
    httpJson(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function buildTrxTransfer(
  rpc: Endpoints,
  from: string,
  to: string,
  amountSun: bigint,
): Promise<TronUnsignedTx> {
  return post(rpc, '/wallet/createtransaction', {
    owner_address: from,
    to_address: to,
    amount: Number(amountSun),
    visible: true,
  });
}

// TRC-20 transfer(address,uint256). parameter = pad32(toAddr20) + pad32(amount).
export function trc20TransferParameter(to: string, amount: bigint): string {
  // Strip '41' prefix from tronAddressToHex to get 40-hex address (20 bytes)
  const toHex40 = tronAddressToHex(to).slice(2);
  // Left-pad address to 64 hex (32 bytes)
  const addrWord = toHex40.padStart(64, '0');
  // Left-pad amount to 64 hex (32 bytes)
  const amountWord = amount.toString(16).padStart(64, '0');
  return addrWord + amountWord;
}

export async function buildTrc20Transfer(
  rpc: Endpoints,
  from: string,
  contract: string,
  to: string,
  amount: bigint,
): Promise<TronUnsignedTx> {
  const res = await post(rpc, '/wallet/triggersmartcontract', {
    owner_address: from,
    contract_address: contract,
    function_selector: 'transfer(address,uint256)',
    parameter: trc20TransferParameter(to, amount),
    fee_limit: 100000000,
    call_value: 0,
    visible: true,
  });
  if (!res?.transaction) {
    throw new Error(`triggersmartcontract failed: ${JSON.stringify(res?.result ?? res)}`);
  }
  return res.transaction;
}
