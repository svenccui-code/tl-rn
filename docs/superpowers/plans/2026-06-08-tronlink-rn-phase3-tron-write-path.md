# TronLink RN — Phase 3 TRON Write Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the TRON write path: build transactions via TronGrid (`createtransaction` / `triggersmartcontract` / `freezebalancev2` / `votewitnessaccount`), **locally re-verify `txID = sha256(raw_data_hex)` and the decoded contract intent**, sign the txID through the existing Phase-0 `signHash` bridge (single- and multi-signature), and broadcast via TronGrid — covering TRX transfer, TRC-20 (USDT) transfer, Stake 2.0 freeze, and voting.

**Architecture:** This is the architecture §5 universal-signing path (the same approach the current native TronLink uses). The TronGrid node builds `raw_data`; the wallet **never trusts the node's `txID` blindly** — it recomputes `sha256(raw_data_hex)` and checks the node's decoded contract params against the caller's request before signing. Only the 32-byte `txID` crosses the bridge via `SecureKeyring.signHash(walletRef, 195, txID)`; the 65-byte signature is appended to the tx's `signature[]` array (N entries for multisig). **No native/codegen changes** (reuses Phase-0 `signHash`).

**Tech Stack:** TypeScript · `@noble/hashes` (sha256 — already a dep) · hand-coded base58check (TRON address ↔ hex) · the Phase-0 `signHash` bridge · the Phase-1 `withFailover`/TronGrid REST · Jest. The TRON `txID` golden vector is a real mainnet transaction pair fetched from TronGrid; the base58 golden vector is the project's golden TRON address.

**Builds on:** [`docs/phase0-foundation.md`](../../phase0-foundation.md) (`signHash` for coinType 195, golden TRON address `TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH`), [`docs/phase1-readonly.md`](../../phase1-readonly.md) (`TronAdapter`, `withFailover`, registry), [`docs/phase2-evm.md`](../../phase2-evm.md) (the signHash-based signing pattern + ABI param padding).

**Scope (this phase):** TRX transfer, TRC-20 transfer, Stake 2.0 freeze (+ the create→verify→sign→broadcast mechanism that makes adding more types trivial), single + multi signature. **Deferred:** unfreeze/withdraw/delegate variants beyond freeze (thin additions, same mechanism — add as needed), **GasFree** (a relayer/meta-tx protocol, its own phase), the `window.tron` DApp provider + TIP-1193 (Phase 4), and **fully-trustless local protobuf re-encoding of `raw_data`** (Phase-3 verifies `txID==sha256(raw_data_hex)` + the node's decoded JSON intent; trustless raw_data decoding / self-operated node is documented hardening, architecture D6).

**Key invariant preserved:** private key never crosses the bridge — `signHash` receives only the 32-byte `txID`, returns only a 65-byte signature.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/tron/txId.ts` | `tronTxId(rawDataHex) → txID` (sha256) |
| `src/tron/address.ts` | base58check `tronAddressToHex` / `hexToTronAddress` |
| `src/tron/tronGolden.ts` | pinned golden vectors: real mainnet (raw_data_hex, txID) pair; golden TRON address ↔ hex |
| `src/tron/types.ts` | `TronUnsignedTx`, `TronSignedTx`, `TronContractParams` |
| `src/tron/build.ts` | TronGrid builders: TRX transfer, TRC-20 transfer, freezeV2, vote |
| `src/tron/verify.ts` | `verifyTronTx(tx, expectedIntent)` — txID + contract-intent gate |
| `src/tron/sign.ts` | `signTronTx` (single) + `signTronTxMulti` (N walletRefs) via signHash |
| `src/tron/broadcast.ts` | `broadcastTronTx` → `/wallet/broadcasttransaction` |
| `src/chain-adapter/TronSigningAdapter.ts` | composes build/verify/sign/broadcast; `getTronSigningAdapter` factory |
| `src/devtools/TronSignSelfTest.ts` + `App.tsx` | on-device capstone (real create → verify → live sign, no broadcast) |
| `docs/phase3-tron.md` | exit gate doc |

---

## Task 1: TRON txID (sha256 of raw_data)

**Files:** Create `src/tron/txId.ts`, `src/tron/tronGolden.ts` (txID part); Test `src/tron/txId.test.ts`

- [ ] **Step 1: Fetch a real mainnet (raw_data_hex, txID) golden pair**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
# A well-known mainnet tx (USDT transfer). Fetch its raw_data_hex + txID from TronGrid:
curl -s -X POST https://api.trongrid.io/wallet/gettransactionbyid \
  -H 'content-type: application/json' \
  -d '{"value":"1c52a4f0e1c8e2d6e0f7b3..."}'   # replace with any real recent mainnet txID
```
Pick any real mainnet txID (e.g. copy a recent transaction hash from tronscan.org), fetch it, and record the returned `txID` and `raw_data_hex`. (If the chosen tx is not found, pick another.) These form a real, stable golden pair: `sha256(hexToBytes(raw_data_hex))` must equal `txID`.

- [ ] **Step 2: Write the failing test** (pin the fetched pair)

```typescript
// src/tron/txId.test.ts
import { tronTxId } from './txId';
import { TRON_GOLDEN } from './tronGolden';

describe('tronTxId', () => {
  it('reproduces a real mainnet txID = sha256(raw_data_hex)', () => {
    expect(tronTxId(TRON_GOLDEN.rawDataHex)).toBe(TRON_GOLDEN.txId);
  });
  it('is lowercase bare hex without 0x prefix', () => {
    expect(tronTxId(TRON_GOLDEN.rawDataHex)).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 3: Run — verify FAIL** (`yarn jest src/tron/txId.test.ts --watchman=false`).

- [ ] **Step 4: Implement**

```typescript
// src/tron/txId.ts
import { sha256 } from '@noble/hashes/sha2';
import { hexToBytes } from '../crypto/bytes';

// TRON txID is the bare (no 0x) lowercase hex of sha256(raw_data bytes).
export function tronTxId(rawDataHex: string): string {
  const clean = rawDataHex.startsWith('0x') ? rawDataHex.slice(2) : rawDataHex;
  const digest = sha256(hexToBytes('0x' + clean));
  let s = '';
  for (const b of digest) s += b.toString(16).padStart(2, '0');
  return s;
}
```

```typescript
// src/tron/tronGolden.ts  (txID part; address part appended in Task 2)
export const TRON_GOLDEN = {
  // Real mainnet transaction pair (Task 1 Step 1). txID = sha256(raw_data_hex).
  rawDataHex: '<PIN_REAL_RAW_DATA_HEX>',
  txId: '<PIN_REAL_TXID>',
};
```
NOTE: confirm the `@noble/hashes/sha2` import path resolves (Task-1/Phase-2 used `@noble/hashes/sha3.js`; sha256 may be `@noble/hashes/sha2.js`). Adjust to what the installed version exposes; the failing import reveals it.

- [ ] **Step 5: Run — verify PASS** (2 passing; tsc clean).

- [ ] **Step 6: Commit**

```bash
git add src/tron/txId.ts src/tron/tronGolden.ts src/tron/txId.test.ts
git commit -m "feat: add TRON txID (sha256 of raw_data) with mainnet golden vector"
```

---

## Task 2: TRON base58check address ↔ hex

**Files:** Create `src/tron/address.ts`; Modify `src/tron/tronGolden.ts` (address part); Test `src/tron/address.test.ts`

- [ ] **Step 1: Derive the golden address hex (tronweb oracle)**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
npx --yes tronweb -e 'const {TronWeb}=require("tronweb"); console.log("HEX=", TronWeb.address.toHex("TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH"))'
```
(If that invocation form fails, use a temp script: `const TronWeb=require("tronweb"); console.log(TronWeb.address.toHex("TUEZ..."))` — API differs by tronweb version.) Record `HEX` — the 42-hex-char `41`-prefixed form of the golden TRON address.

- [ ] **Step 2: Write the failing test** (pin the hex from Step 1)

```typescript
// src/tron/address.test.ts
import { tronAddressToHex, hexToTronAddress } from './address';
import { TRON_GOLDEN } from './tronGolden';

const ADDR = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';

describe('tron address', () => {
  it('decodes base58 to 41-prefixed hex (golden)', () => {
    expect(tronAddressToHex(ADDR)).toBe(TRON_GOLDEN.addressHex); // e.g. '41....' 42 hex chars
  });
  it('round-trips hex -> base58', () => {
    expect(hexToTronAddress(tronAddressToHex(ADDR))).toBe(ADDR);
  });
  it('rejects a corrupted address (bad checksum)', () => {
    expect(() => tronAddressToHex('TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdX')).toThrow();
  });
});
```

- [ ] **Step 3: Run — verify FAIL.**

- [ ] **Step 4: Implement base58check**

```typescript
// src/tron/address.ts
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, concatBytes, hexToBytes } from '../crypto/bytes';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58decode(str: string): Uint8Array {
  let num = 0n;
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`invalid base58 char: ${ch}`);
    num = num * 58n + BigInt(idx);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  let bytes = hex === '0' ? new Uint8Array([]) : hexToBytes('0x' + hex);
  // restore leading zero bytes (each leading '1' = a 0x00 byte)
  let leading = 0;
  for (const ch of str) { if (ch === '1') leading++; else break; }
  if (leading) bytes = concatBytes(new Uint8Array(leading), bytes);
  return bytes;
}

function b58encode(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) { out = ALPHABET[Number(num % 58n)] + out; num /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
  return out;
}

function sha256d(bytes: Uint8Array): Uint8Array { return sha256(sha256(bytes)); }

// 'TUEZ...' -> '41' + 40-hex (42 hex chars total)
export function tronAddressToHex(base58: string): string {
  const data = b58decode(base58);              // 25 bytes: 21 payload + 4 checksum
  if (data.length !== 25) throw new Error('bad TRON address length');
  const payload = data.slice(0, 21);
  const checksum = data.slice(21);
  const expected = sha256d(payload).slice(0, 4);
  for (let i = 0; i < 4; i++) if (checksum[i] !== expected[i]) throw new Error('bad TRON address checksum');
  return bytesToHex(payload).slice(2);         // strip '0x'
}

export function hexToTronAddress(hex: string): string {
  const payload = hexToBytes(hex.startsWith('0x') ? hex : '0x' + hex);
  if (payload.length !== 21 || payload[0] !== 0x41) throw new Error('bad TRON hex address');
  const checksum = sha256d(payload).slice(0, 4);
  return b58encode(concatBytes(payload, checksum));
}
```

- [ ] **Step 5: Pin `addressHex`** in `src/tron/tronGolden.ts` (add `addressHex: '<HEX from Step 1>'`).

- [ ] **Step 6: Run — verify PASS** (3 passing; the round-trip + checksum-reject prove correctness independently of the pin; tsc clean).

- [ ] **Step 7: Commit**

```bash
git add src/tron/address.ts src/tron/address.test.ts src/tron/tronGolden.ts
git commit -m "feat: add TRON base58check address <-> hex conversion"
```

---

## Task 3: TronGrid transaction builders (TRX + TRC-20)

**Files:** Create `src/tron/types.ts`, `src/tron/build.ts`; Test `src/tron/build.test.ts`

`TronUnsignedTx` = the node's create response: `{ txID: string; raw_data: any; raw_data_hex: string; visible: boolean }`. Use `visible: true` everywhere (base58 addresses in/out).

- [ ] **Step 1: Write the failing test** (mocked TronGrid)

```typescript
// src/tron/build.test.ts
declare const global: any;
import { buildTrxTransfer, buildTrc20Transfer } from './build';

const RPC = { primary: 'https://trongrid', fallback: [] };
const FROM = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';
const TO = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC';

describe('buildTrxTransfer', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());
  it('POSTs createtransaction with visible base58 + amount in sun', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ txID: 'abcd', raw_data: {}, raw_data_hex: '0a02', visible: true }) });
    const tx = await buildTrxTransfer(RPC, FROM, TO, 1000000n);
    expect(tx.txID).toBe('abcd');
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('https://trongrid/wallet/createtransaction');
    expect(JSON.parse(call[1].body)).toEqual({ owner_address: FROM, to_address: TO, amount: 1000000, visible: true });
  });
});

describe('buildTrc20Transfer', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());
  it('POSTs triggersmartcontract with transfer(address,uint256) param', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { result: true }, transaction: { txID: 'beef', raw_data: {}, raw_data_hex: '0a02', visible: true } }) });
    const usdt = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    const tx = await buildTrc20Transfer(RPC, FROM, usdt, TO, 5000000n);
    expect(tx.txID).toBe('beef');
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.function_selector).toBe('transfer(address,uint256)');
    // parameter = 32-byte to-address (no 41 prefix) + 32-byte amount
    expect(body.parameter).toMatch(/^0{24}[0-9a-f]{40}0{58}4c4b40$/); // amount 5_000_000 = 0x4c4b40
    expect(body.contract_address).toBe(usdt);
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement types + builders**

```typescript
// src/tron/types.ts
export interface TronUnsignedTx { txID: string; raw_data: any; raw_data_hex: string; visible: boolean; }
export interface TronSignedTx extends TronUnsignedTx { signature: string[]; }
export interface Endpoints { primary: string; fallback: string[]; }
```

```typescript
// src/tron/build.ts
import { httpJson, withFailover } from '../net/http';
import { tronAddressToHex } from './address';
import type { Endpoints, TronUnsignedTx } from './types';

async function post(rpc: Endpoints, path: string, body: any): Promise<any> {
  return withFailover(rpc, base =>
    httpJson(`${base}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }),
  );
}

export async function buildTrxTransfer(rpc: Endpoints, from: string, to: string, amountSun: bigint): Promise<TronUnsignedTx> {
  return post(rpc, '/wallet/createtransaction', {
    owner_address: from, to_address: to, amount: Number(amountSun), visible: true,
  });
}

// TRC-20 transfer(address,uint256). parameter = pad32(toAddr20) + pad32(amount).
export function trc20TransferParameter(to: string, amount: bigint): string {
  const toHex40 = tronAddressToHex(to).slice(2);            // strip '41' prefix -> 40 hex (20 bytes)
  const addrWord = toHex40.padStart(64, '0');
  const amountWord = amount.toString(16).padStart(64, '0');
  return addrWord + amountWord;
}

export async function buildTrc20Transfer(rpc: Endpoints, from: string, contract: string, to: string, amount: bigint): Promise<TronUnsignedTx> {
  const res = await post(rpc, '/wallet/triggersmartcontract', {
    owner_address: from,
    contract_address: contract,
    function_selector: 'transfer(address,uint256)',
    parameter: trc20TransferParameter(to, amount),
    fee_limit: 100000000,
    call_value: 0,
    visible: true,
  });
  if (!res?.transaction) throw new Error(`triggersmartcontract failed: ${JSON.stringify(res?.result ?? res)}`);
  return res.transaction;
}
```

- [ ] **Step 4: Run — verify PASS** (2 passing; tsc clean). NOTE: the TRC-20 `parameter` regex in the test encodes the address minus its `41` prefix as the 20-byte EVM-style word — confirm `trc20TransferParameter` strips `41` (the first 2 hex chars) so the 20-byte address is left-padded to 32 bytes.

- [ ] **Step 5: Commit**

```bash
git add src/tron/types.ts src/tron/build.ts src/tron/build.test.ts
git commit -m "feat: add TronGrid TRX + TRC-20 transaction builders"
```

---

## Task 4: Verify gate + sign (single + multisig)

**Files:** Create `src/tron/verify.ts`, `src/tron/sign.ts`; Test `src/tron/verify.test.ts`, `src/tron/sign.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/tron/verify.test.ts
import { verifyTronTx } from './verify';
import { tronTxId } from './txId';
import { TRON_GOLDEN } from './tronGolden';

const tx = (rawHex: string, txId: string, params: any) => ({
  txID: txId, raw_data_hex: rawHex, visible: true,
  raw_data: { contract: [{ parameter: { value: params } }] },
});

describe('verifyTronTx', () => {
  it('passes when txID == sha256(raw_data_hex) and intent matches', () => {
    const t = tx(TRON_GOLDEN.rawDataHex, TRON_GOLDEN.txId, { owner_address: 'TFrom', to_address: 'TTo', amount: 5 });
    expect(() => verifyTronTx(t as any, { owner: 'TFrom', to: 'TTo', amount: 5 })).not.toThrow();
  });
  it('throws when txID does not match sha256(raw_data_hex) (tampered node)', () => {
    const t = tx(TRON_GOLDEN.rawDataHex, 'deadbeef'.padEnd(64, '0'), {});
    expect(() => verifyTronTx(t as any, {})).toThrow(/txID/i);
  });
  it('throws when the decoded intent does not match the request', () => {
    const t = tx(TRON_GOLDEN.rawDataHex, TRON_GOLDEN.txId, { owner_address: 'TFrom', to_address: 'TEvil', amount: 5 });
    expect(() => verifyTronTx(t as any, { owner: 'TFrom', to: 'TTo', amount: 5 })).toThrow(/intent|to/i);
  });
});
```

```typescript
// src/tron/sign.test.ts
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { signTronTx, signTronTxMulti } from './sign';
import { TRON_GOLDEN } from './tronGolden';

const unsigned = { txID: TRON_GOLDEN.txId, raw_data: {}, raw_data_hex: TRON_GOLDEN.rawDataHex, visible: true };

describe('signTronTx', () => {
  it('signs the txID via signHash(195) and appends bare-hex signature', async () => {
    (SecureKeyring.signHash as jest.Mock).mockResolvedValue('0x' + 'ab'.repeat(65));
    const signed = await signTronTx(unsigned as any, 'wref');
    expect(SecureKeyring.signHash).toHaveBeenCalledWith('wref', 195, '0x' + TRON_GOLDEN.txId);
    expect(signed.signature).toEqual(['ab'.repeat(65)]);            // no 0x prefix in TRON signatures
  });
  it('multisig appends one signature per walletRef', async () => {
    (SecureKeyring.signHash as jest.Mock)
      .mockResolvedValueOnce('0x' + '11'.repeat(65))
      .mockResolvedValueOnce('0x' + '22'.repeat(65));
    const signed = await signTronTxMulti(unsigned as any, ['w1', 'w2']);
    expect(signed.signature).toEqual(['11'.repeat(65), '22'.repeat(65)]);
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement verify**

```typescript
// src/tron/verify.ts
import { tronTxId } from './txId';
import type { TronUnsignedTx } from './types';

export interface TronIntent { owner?: string; to?: string; amount?: number | bigint; contract?: string; }

// SECURITY GATE: never sign a node-provided txID without recomputing it locally,
// and never sign without confirming the decoded contract params match the caller's intent.
export function verifyTronTx(tx: TronUnsignedTx, intent: TronIntent): void {
  const recomputed = tronTxId(tx.raw_data_hex);
  if (recomputed !== tx.txID) {
    throw new Error(`txID mismatch: node ${tx.txID} != local ${recomputed}`);
  }
  const value = tx.raw_data?.contract?.[0]?.parameter?.value ?? {};
  if (intent.owner && value.owner_address && value.owner_address !== intent.owner) {
    throw new Error(`intent owner mismatch: ${value.owner_address} != ${intent.owner}`);
  }
  if (intent.to && value.to_address && value.to_address !== intent.to) {
    throw new Error(`intent to mismatch: ${value.to_address} != ${intent.to}`);
  }
  if (intent.amount != null && value.amount != null && BigInt(value.amount) !== BigInt(intent.amount)) {
    throw new Error(`intent amount mismatch: ${value.amount} != ${intent.amount}`);
  }
}
```
> Honest limitation (documented in the exit doc): `verifyTronTx` checks `txID == sha256(raw_data_hex)` (so the bytes we sign are the ones the node returned) and that the node's **decoded JSON** intent matches the request. It does NOT independently decode `raw_data_hex` protobuf, so it trusts the node's JSON decode to correspond to the hex. Fully-trustless verification (local protobuf decode) or a self-operated node is Phase-3 hardening (architecture D6).

- [ ] **Step 4: Implement sign**

```typescript
// src/tron/sign.ts
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import type { TronSignedTx, TronUnsignedTx } from './types';

const TRON_COIN_TYPE = 195;

async function signTxId(txID: string, walletRef: string): Promise<string> {
  const sig = await SecureKeyring.signHash(walletRef, TRON_COIN_TYPE, '0x' + txID);
  return sig.startsWith('0x') ? sig.slice(2) : sig;   // TRON signatures are bare hex
}

export async function signTronTx(tx: TronUnsignedTx, walletRef: string): Promise<TronSignedTx> {
  return { ...tx, signature: [await signTxId(tx.txID, walletRef)] };
}

// Multisig: each permission key signs the same txID; signatures appended in order.
export async function signTronTxMulti(tx: TronUnsignedTx, walletRefs: string[]): Promise<TronSignedTx> {
  const signature: string[] = [];
  for (const ref of walletRefs) signature.push(await signTxId(tx.txID, ref));
  return { ...tx, signature };
}
```

- [ ] **Step 5: Run — verify PASS** (verify 3 + sign 2; tsc clean). NOTE: `signTronTx` does NOT itself call `verifyTronTx` — the adapter (Task 6) calls verify then sign, so verify is mandatory at the adapter layer. (Keep them separate for testability.)

- [ ] **Step 6: Commit**

```bash
git add src/tron/verify.ts src/tron/sign.ts src/tron/verify.test.ts src/tron/sign.test.ts
git commit -m "feat: add TRON txID/intent verify gate + single/multisig signing"
```

---

## Task 5: Broadcast + Stake 2.0 (freeze) + vote builders

**Files:** Create `src/tron/broadcast.ts`; Modify `src/tron/build.ts`; Test `src/tron/broadcast.test.ts`, extend `src/tron/build.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/tron/broadcast.test.ts
declare const global: any;
import { broadcastTronTx } from './broadcast';

const RPC = { primary: 'https://trongrid', fallback: [] };
const signed = { txID: 'abcd', raw_data: {}, raw_data_hex: '0a02', visible: true, signature: ['ab'] };

describe('broadcastTronTx', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());
  it('POSTs the signed tx and returns the txid on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: true, txid: 'abcd' }) });
    await expect(broadcastTronTx(RPC, signed as any)).resolves.toBe('abcd');
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('https://trongrid/wallet/broadcasttransaction');
    expect(JSON.parse(call[1].body).signature).toEqual(['ab']);
  });
  it('throws on a failed broadcast', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: false, code: 'SIGERROR', message: '6261' }) });
    await expect(broadcastTronTx(RPC, signed as any)).rejects.toThrow(/SIGERROR|broadcast/i);
  });
});
```

```typescript
// add to src/tron/build.test.ts
import { buildFreezeV2, buildVote } from './build';
// ... inside describe blocks (mock fetch like the others):
it('buildFreezeV2 POSTs freezebalancev2', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ txID: 'f1', raw_data: {}, raw_data_hex: '0a', visible: true }) });
  const tx = await buildFreezeV2(RPC, FROM, 1000000n, 'ENERGY');
  expect(tx.txID).toBe('f1');
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body).toEqual({ owner_address: FROM, frozen_balance: 1000000, resource: 'ENERGY', visible: true });
});
it('buildVote POSTs votewitnessaccount', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ txID: 'v1', raw_data: {}, raw_data_hex: '0a', visible: true }) });
  const tx = await buildVote(RPC, FROM, [{ srAddress: 'TSr', voteCount: 3 }]);
  expect(tx.txID).toBe('v1');
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.votes).toEqual([{ vote_address: 'TSr', vote_count: 3 }]);
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement broadcast**

```typescript
// src/tron/broadcast.ts
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
```

- [ ] **Step 4: Append freeze + vote builders to `src/tron/build.ts`**

```typescript
// append to src/tron/build.ts
export async function buildFreezeV2(rpc: Endpoints, from: string, frozenSun: bigint, resource: 'ENERGY' | 'BANDWIDTH'): Promise<TronUnsignedTx> {
  return post(rpc, '/wallet/freezebalancev2', {
    owner_address: from, frozen_balance: Number(frozenSun), resource, visible: true,
  });
}

export interface VoteEntry { srAddress: string; voteCount: number; }
export async function buildVote(rpc: Endpoints, from: string, votes: VoteEntry[]): Promise<TronUnsignedTx> {
  return post(rpc, '/wallet/votewitnessaccount', {
    owner_address: from,
    votes: votes.map(v => ({ vote_address: v.srAddress, vote_count: v.voteCount })),
    visible: true,
  });
}
```

- [ ] **Step 5: Run — verify PASS** (broadcast 2 + build freeze/vote 2 + prior; full suite green; tsc clean).

- [ ] **Step 6: Commit**

```bash
git add src/tron/broadcast.ts src/tron/build.ts src/tron/broadcast.test.ts src/tron/build.test.ts
git commit -m "feat: add TRON broadcast + Stake 2.0 freeze + vote builders"
```

---

## Task 6: TronSigningAdapter (compose + factory)

**Files:** Create `src/chain-adapter/TronSigningAdapter.ts`; Test `src/chain-adapter/TronSigningAdapter.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/chain-adapter/TronSigningAdapter.test.ts
declare const global: any;
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { TronSigningAdapter, getTronSigningAdapter } from './TronSigningAdapter';
import { TRON_GOLDEN } from '../tron/tronGolden';
import type { ChainConfig } from '../chain-registry/types';

const TRON: ChainConfig = {
  caip2: 'tron:728126428', coinType: 195, family: 'tron', name: 'TRON', nativeSymbol: 'TRX',
  decimals: 6, rpc: { primary: 'https://trongrid', fallback: [] }, explorerTx: 'https://t/',
  capabilities: { dapp: true, nft: true, defi: true },
};
const FROM = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';
const TO = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC';

describe('TronSigningAdapter', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());

  it('getTronSigningAdapter returns a TronSigningAdapter for tron', () => {
    expect(getTronSigningAdapter(TRON)).toBeInstanceOf(TronSigningAdapter);
  });

  it('sendTrx: build -> verify -> sign -> broadcast (verify gate enforced)', async () => {
    const value = { owner_address: FROM, to_address: TO, amount: 1000000 };
    const built = { txID: TRON_GOLDEN.txId, raw_data: { contract: [{ parameter: { value } }] }, raw_data_hex: TRON_GOLDEN.rawDataHex, visible: true };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => built })                          // createtransaction
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: true, txid: TRON_GOLDEN.txId }) }); // broadcast
    (SecureKeyring.signHash as jest.Mock).mockResolvedValue('0x' + 'cd'.repeat(65));
    const a = new TronSigningAdapter(TRON);
    const txid = await a.sendTrx('wref', FROM, TO, 1000000n);
    expect(SecureKeyring.signHash).toHaveBeenCalledWith('wref', 195, '0x' + TRON_GOLDEN.txId);
    expect(txid).toBe(TRON_GOLDEN.txId);
    // broadcast body carried the signature
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).signature).toEqual(['cd'.repeat(65)]);
  });

  it('aborts (no broadcast) if the node returns a mismatched txID', async () => {
    const built = { txID: 'dead'.padEnd(64, '0'), raw_data: { contract: [{ parameter: { value: {} } }] }, raw_data_hex: TRON_GOLDEN.rawDataHex, visible: true };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => built });
    const a = new TronSigningAdapter(TRON);
    await expect(a.sendTrx('wref', FROM, TO, 1000000n)).rejects.toThrow(/txID/i);
    expect(SecureKeyring.signHash).not.toHaveBeenCalled(); // never signed a bad tx
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement**

```typescript
// src/chain-adapter/TronSigningAdapter.ts
import type { ChainConfig } from '../chain-registry/types';
import { TronAdapter } from './TronAdapter';
import { buildTrxTransfer, buildTrc20Transfer, buildFreezeV2, buildVote, VoteEntry } from '../tron/build';
import { verifyTronTx, TronIntent } from '../tron/verify';
import { signTronTx, signTronTxMulti } from '../tron/sign';
import { broadcastTronTx } from '../tron/broadcast';
import type { TronUnsignedTx } from '../tron/types';

export class TronSigningAdapter extends TronAdapter {
  private rpc() { return this.config.rpc; }

  // Generic: verify -> sign -> broadcast. Always verifies before signing.
  private async signAndBroadcast(tx: TronUnsignedTx, walletRef: string, intent: TronIntent): Promise<string> {
    verifyTronTx(tx, intent);
    const signed = await signTronTx(tx, walletRef);
    return broadcastTronTx(this.rpc(), signed);
  }

  async sendTrx(walletRef: string, from: string, to: string, amountSun: bigint): Promise<string> {
    const tx = await buildTrxTransfer(this.rpc(), from, to, amountSun);
    return this.signAndBroadcast(tx, walletRef, { owner: from, to, amount: amountSun });
  }

  async sendTrc20(walletRef: string, from: string, contract: string, to: string, amount: bigint): Promise<string> {
    const tx = await buildTrc20Transfer(this.rpc(), from, contract, to, amount);
    // Note: TRC-20 params live in raw_data.contract[0].parameter.value.data (encoded); intent here checks owner only.
    return this.signAndBroadcast(tx, walletRef, { owner: from });
  }

  async freeze(walletRef: string, from: string, frozenSun: bigint, resource: 'ENERGY' | 'BANDWIDTH'): Promise<string> {
    const tx = await buildFreezeV2(this.rpc(), from, frozenSun, resource);
    return this.signAndBroadcast(tx, walletRef, { owner: from });
  }

  async vote(walletRef: string, from: string, votes: VoteEntry[]): Promise<string> {
    const tx = await buildVote(this.rpc(), from, votes);
    return this.signAndBroadcast(tx, walletRef, { owner: from });
  }

  // Multisig: verify, sign with N permission keys, broadcast.
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
```

- [ ] **Step 4: Run — verify PASS** (3 passing — note the critical "aborts on mismatched txID, signHash NOT called" test; full suite green; tsc clean).

- [ ] **Step 5: Commit**

```bash
git add src/chain-adapter/TronSigningAdapter.ts src/chain-adapter/TronSigningAdapter.test.ts
git commit -m "feat: add TronSigningAdapter (verify-gate build/sign/broadcast + multisig)"
```

---

## Task 7: On-device capstone — real create → verify → live sign (no broadcast)

**Files:** Create `src/devtools/TronSignSelfTest.ts`; Modify `App.tsx`

Proves the full TRON write mechanism against the live TronGrid node on both platforms, WITHOUT broadcasting (zero funds): create a real TRX transfer from the golden address, locally verify `txID == sha256(raw_data_hex)`, confirm `owner_address` decodes to the golden address, then sign the txID via the live `signHash` and confirm a well-formed 65-byte signature is produced and attached. (The signature's determinism for a fixed hash is already Phase-0-proven; TRON txs are not reproducible across runs due to ref-block/timestamp, so this asserts mechanism + integrity, not a pinned signed tx.)

- [ ] **Step 1: Create `src/devtools/TronSignSelfTest.ts`**

```typescript
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { GOLDEN } from '../crypto/goldenVectors';
import { getChain } from '../chain-registry/chains';
import { buildTrxTransfer } from '../tron/build';
import { tronTxId } from '../tron/txId';

export type Line = { name: string; ok: boolean; detail: string };

export async function runTronSignSelfTest(): Promise<Line[]> {
  const out: Line[] = [];
  const tron = getChain('tron:728126428')!;
  const ref = await SecureKeyring.importMnemonic(GOLDEN.mnemonic);
  const from = await SecureKeyring.deriveAddress(ref, 195);
  out.push({ name: 'derive TRON', ok: from === GOLDEN.tron.expectedAddress, detail: from });

  // Real, read-only: createtransaction does not broadcast or cost anything.
  const tx = await buildTrxTransfer(tron.rpc, from, from, 1000000n); // 1 TRX to self (never broadcast)
  const localTxId = tronTxId(tx.raw_data_hex);
  out.push({ name: 'txID == sha256(raw_data_hex)', ok: localTxId === tx.txID, detail: tx.txID.slice(0, 16) + '…' });

  const owner = tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address;
  out.push({ name: 'owner_address == golden', ok: owner === from, detail: String(owner) });

  const sig = await SecureKeyring.signHash(ref, 195, '0x' + tx.txID); // real TWCore signature of the verified txID
  const bare = sig.startsWith('0x') ? sig.slice(2) : sig;
  out.push({ name: 'signHash 65-byte signature', ok: bare.length === 130, detail: bare.slice(0, 16) + '…' });

  await SecureKeyring.deleteWallet(ref);
  return out; // NOTE: deliberately NOT broadcast — zero funds at risk.
}
```

- [ ] **Step 2: Wire into App.tsx** — add a `runAndLog('TRONSIGN', runTronSignSelfTest, setTronSign)` probe + render panel, logging `TRONSIGN_*` sentinels (RESULT derived from `lines.every(l=>l.ok)`).

- [ ] **Step 3: Keep Jest + tsc green** (`yarn jest --watchman=false` all pass; `yarn tsc --noEmit` clean). In the App-render test the mocked bridge returns fixed values and `fetch` is unavailable → `buildTrxTransfer` throws, caught by `runAndLog`'s try/catch (logs TRONSIGN_RESULT=ERROR) — the render test only renders, so it still passes. Confirm no unhandled rejection breaks the suite (forceExit is set).

- [ ] **Step 4: Android device verification**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
adb logcat -c
npx react-native run-android
sleep 25
adb logcat -d | grep -E "TRONSIGN_" | tail
```
Expected: `TRONSIGN_LINE PASS derive TRON | TUEZ…`, `TRONSIGN_LINE PASS txID == sha256(raw_data_hex) | …`, `TRONSIGN_LINE PASS owner_address == golden | TUEZ…`, `TRONSIGN_LINE PASS signHash 65-byte signature | …`, `TRONSIGN_RESULT=ALL_PASS`. CAPTURE.

- [ ] **Step 5: iOS device verification**

```bash
npx react-native start --client-logs > /tmp/metro-tron.log 2>&1 &
npx react-native run-ios --simulator "iPhone 17 Pro"
sleep 30
grep -E "TRONSIGN_" /tmp/metro-tron.log | tail
```
Expected: same `TRONSIGN_RESULT=ALL_PASS`. CAPTURE. (If TronGrid rate-limits the unauthenticated create call, retry; the `derive` + signHash lines must always PASS regardless.)

- [ ] **Step 6: Commit** (after TRONSIGN_RESULT=ALL_PASS both platforms)

```bash
git add src/devtools/TronSignSelfTest.ts App.tsx
git commit -m "test: on-device TRON write mechanism (create->verify->live sign, no broadcast)"
```

---

## Task 8: Phase-3 exit gate documentation

**Files:** Create `docs/phase3-tron.md`

- [ ] **Step 1: Write the doc** capturing: the create→verify→sign→broadcast mechanism, the security gate (`txID==sha256(raw_data_hex)` + node-JSON intent check) AND its honest trust limitation (no local protobuf decode yet → trust the node's decode / use self-operated node; architecture D6), the golden vectors (real mainnet txID pair; golden address↔hex), supported tx types (TRX, TRC-20, freeze V2, vote) + multisig signing, exit criteria + evidence, deferred items (unfreeze/delegate variants, GasFree, window.tron provider, fully-trustless raw_data decode), and the Phase-3→Phase-4 handoff (dual DApp provider).

Exit criteria (all ✅):
1. Full Jest suite passes (txId, address, build, verify, sign, broadcast, TronSigningAdapter + all prior).
2. `yarn tsc --noEmit` clean.
3. On-device `TRONSIGN_RESULT=ALL_PASS` both platforms: real TronGrid create → local txID verify → owner==golden → live `signHash` 65-byte signature. (No broadcast — zero funds.)
4. Security gate proven: the adapter test confirms a mismatched node txID aborts BEFORE `signHash` is called.

- [ ] **Step 2: Commit**

```bash
git add docs/phase3-tron.md
git commit -m "docs: record Phase-3 TRON write-path exit gate"
```

---

## Self-Review

**Spec coverage (architecture §5 dual-signing, §6.2/6.3 TRON flows, §9 Phase 3):**
- create → recompute txID → signHash → reassemble (§5 mode-2) → Tasks 1/4/6. ✅
- TRX transfer / TRC-20 transfer / Stake 2.0 freeze / vote builders → Tasks 3/5. ✅
- multisig (N signatures over the same txID) → Tasks 4/6. ✅
- TronGrid broadcast → Task 5. ✅
- private key never crosses bridge (only txID) → Tasks 4/6 (signHash with txID). ✅
- security: never sign an unverified node txID; intent check → Task 4 verify gate, enforced in Task 6 adapter (test proves signHash NOT called on mismatch). ✅
- Deferred & labeled: GasFree, window.tron provider, unfreeze/delegate beyond freeze, fully-trustless raw_data protobuf decode. ✅ (scoped)

**Placeholder scan:** Real code throughout. `<PIN_REAL_RAW_DATA_HEX>` / `<PIN_REAL_TXID>` / `<HEX>` are verify-and-pin slots with exact derivation commands (Task 1 Step 1 TronGrid fetch; Task 2 Step 1 tronweb oracle) — real, checkable values, not lazy gaps.

**Type consistency:** `TronUnsignedTx` (txID, raw_data, raw_data_hex, visible) is produced by every builder (Task 3/5), consumed by `verifyTronTx` (Task 4), `signTronTx`/`signTronTxMulti` (Task 4, → `TronSignedTx` adding `signature: string[]`), `broadcastTronTx` (Task 5), and `TronSigningAdapter` (Task 6). `Endpoints {primary, fallback}` matches `ChainConfig.rpc` and the Phase-1 `withFailover` signature. `tronTxId` returns bare lowercase hex; `signHash` is called with `'0x' + txID` (coinType 195) and its `0x`-stripped result populates `signature[]`. `tronAddressToHex` (Task 2) feeds `trc20TransferParameter` (Task 3). `TronSigningAdapter extends TronAdapter` so Phase-1 TRON read methods are inherited. Golden constants in `tronGolden.ts` (rawDataHex, txId, addressHex) are consumed by Tasks 1/2/4/6/7.
