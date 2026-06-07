# TronLink RN — Phase 2 EVM Full Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the EVM write path on top of the Phase-1 read-only layer: a `SigningChainAdapter` with `buildTransaction` (EIP-1559) → `sign` (via the existing native `signHash` bridge) → `broadcast` (`eth_sendRawTransaction`), `personal_sign` message signing, and an EVM WebView provider (`window.ethereum`, EIP-1193) that routes DApp requests through this stack.

**Architecture:** EVM transactions are assembled and RLP/keccak-encoded **in TypeScript**; only the 32-byte signing hash crosses the bridge via the proven Phase-0 `signHash` (private key never leaves native). This is the architecture §5 mode-2 universal path applied to EVM — it avoids any native/codegen changes and is fully Jest-testable with deterministic golden vectors cross-checked against ethers. The WebView provider injects an EIP-1193 `window.ethereum`, posting requests to the RN host which routes reads to the failover RPC client and writes/signing to the adapter.

**Tech Stack:** TypeScript · `@noble/hashes` (keccak-256, audited pure-TS, hashing only — no key handling) · hand-coded RLP + EIP-1559 (type-2) tx encoding · the Phase-0 `signHash` bridge · the Phase-1 registry/net/adapter layers · `react-native-webview` · Jest. Golden EVM signed-tx vector is produced by **ethers** (offline oracle, via `npx`, not a project dependency) and pinned.

**Builds on:** [`docs/phase1-readonly.md`](../../phase1-readonly.md) (registry, `withFailover`/`jsonRpc`, `EvmAdapter`, `ReadOnlyChainAdapter`) and [`docs/phase0-foundation.md`](../../phase0-foundation.md) (`SecureKeyring.signHash`).

**Scope (this phase):** EVM only. TRON write path = Phase 3. `eth_signTypedData_v4` (EIP-712), full DApp connect/approval UX, and the dual `window.tron` provider = Phase 4 (noted, not built). Broadcasting is implemented and unit-tested; an on-device real broadcast requires a funded testnet account and is an optional manual step, not an automated gate (zero-funds discipline).

**Key invariant preserved:** private key never crosses the bridge — `signHash` receives only a keccak-256 hash and returns only a 65-byte signature.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/crypto/keccak.ts` | `keccak256(bytes|hex) → hex` (wraps `@noble/hashes`) |
| `src/crypto/bytes.ts` | hex ↔ Uint8Array, bigint ↔ minimal big-endian bytes, concat |
| `src/evm/rlp.ts` | minimal RLP encoder |
| `src/evm/tx.ts` | EIP-1559 unsigned encode + signing hash + signed-tx assemble + txHash |
| `src/evm/evmGolden.ts` | pinned golden EVM tx params + signature + signed rawTx (ethers-derived) |
| `src/chain-adapter/signing-types.ts` | `SigningChainAdapter`, `TxRequest`, `UnsignedEvmTx`, `SignedTx` |
| `src/chain-adapter/EvmSigningAdapter.ts` | build / sign / broadcast / personal_sign |
| `src/evm/provider-inject.ts` | `buildEthereumProviderScript()` → injected EIP-1193 JS string |
| `src/evm/providerProtocol.ts` | shared request/response message types + id helpers (testable) |
| `src/dapp/EvmDappWebView.tsx` | RN WebView host + message router |
| `src/dapp/evmRequestRouter.ts` | pure router: `(method, params, ctx) → result` (testable) |
| `src/devtools/EvmSignSelfTest.ts` + `App.tsx` | on-device golden signed-tx parity capstone |
| `assets/dapp-selftest.html` | local DApp page exercising the provider on device |
| `docs/phase2-evm.md` | exit gate doc |

---

## Task 1: keccak-256 + byte helpers

**Files:** Create `src/crypto/keccak.ts`, `src/crypto/bytes.ts`; Test `src/crypto/bytes.test.ts`, `src/crypto/keccak.test.ts`

- [ ] **Step 1: Add the dependency**

Run: `cd /Users/viccc/working/rn_eth/tronlink-rn && yarn add @noble/hashes`
Expected: added to `package.json` dependencies. (Pure TS, Hermes-compatible, hashing only.)

- [ ] **Step 2: Write failing tests**

```typescript
// src/crypto/bytes.test.ts
import { hexToBytes, bytesToHex, bigIntToMinimalBytes, concatBytes } from './bytes';

describe('bytes', () => {
  it('hex <-> bytes round-trips', () => {
    expect(bytesToHex(hexToBytes('0x0a0b'))).toBe('0x0a0b');
    expect(Array.from(hexToBytes('0xff00'))).toEqual([255, 0]);
  });
  it('bigint to minimal big-endian (no leading zeros; 0 -> empty)', () => {
    expect(Array.from(bigIntToMinimalBytes(0n))).toEqual([]);
    expect(Array.from(bigIntToMinimalBytes(1n))).toEqual([1]);
    expect(Array.from(bigIntToMinimalBytes(256n))).toEqual([1, 0]);
    expect(bytesToHex(bigIntToMinimalBytes(1000000000000000n))).toBe('0x038d7ea4c68000');
  });
  it('concatBytes joins', () => {
    expect(Array.from(concatBytes(new Uint8Array([1]), new Uint8Array([2, 3])))).toEqual([1, 2, 3]);
  });
});
```

```typescript
// src/crypto/keccak.test.ts
import { keccak256 } from './keccak';

describe('keccak256', () => {
  it('hashes empty input to the known constant', () => {
    expect(keccak256('0x')).toBe('0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  });
  it('accepts bytes', () => {
    expect(keccak256(new Uint8Array([]))).toBe('0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  });
});
```

- [ ] **Step 3: Run — verify FAIL**

Run: `yarn jest src/crypto/bytes.test.ts src/crypto/keccak.test.ts --watchman=false`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement**

```typescript
// src/crypto/bytes.ts
export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) throw new Error(`odd hex length: ${hex}`);
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = '0x';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export function bigIntToMinimalBytes(value: bigint): Uint8Array {
  if (value < 0n) throw new Error('negative');
  if (value === 0n) return new Uint8Array([]);
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return hexToBytes('0x' + hex);
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}
```

```typescript
// src/crypto/keccak.ts
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from './bytes';

// keccak-256 of public transaction/message data. Never used on private keys.
export function keccak256(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? hexToBytes(input) : input;
  return bytesToHex(keccak_256(bytes));
}
```

- [ ] **Step 5: Run — verify PASS** (`yarn jest src/crypto/*.test.ts --watchman=false` → all pass; `yarn tsc --noEmit` clean). If `@noble/hashes/sha3` import path differs in the installed version, adjust to the package's documented entry (the failing import will reveal it).

- [ ] **Step 6: Commit**

```bash
git add package.json yarn.lock src/crypto/keccak.ts src/crypto/bytes.ts src/crypto/keccak.test.ts src/crypto/bytes.test.ts
git commit -m "feat: add keccak-256 and byte helpers for EVM encoding"
```

---

## Task 2: RLP encoder

**Files:** Create `src/evm/rlp.ts`; Test `src/evm/rlp.test.ts`

- [ ] **Step 1: Write failing tests** (canonical RLP vectors)

```typescript
// src/evm/rlp.test.ts
import { rlpEncode } from './rlp';
import { hexToBytes, bytesToHex } from '../crypto/bytes';

const b = (h: string) => hexToBytes(h);

describe('rlpEncode', () => {
  it('encodes empty string as 0x80', () => {
    expect(bytesToHex(rlpEncode(b('0x')))).toBe('0x80');
  });
  it('encodes a single byte < 0x80 as itself', () => {
    expect(bytesToHex(rlpEncode(b('0x01')))).toBe('0x01');
  });
  it('encodes "dog" (0x646f67) with 0x83 prefix', () => {
    expect(bytesToHex(rlpEncode(b('0x646f67')))).toBe('0x83646f67');
  });
  it('encodes the list ["cat","dog"]', () => {
    expect(bytesToHex(rlpEncode([b('0x636174'), b('0x646f67')]))).toBe('0xc88363617483646f67');
  });
  it('encodes the empty list as 0xc0', () => {
    expect(bytesToHex(rlpEncode([]))).toBe('0xc0');
  });
});
```

- [ ] **Step 2: Run — verify FAIL** (`yarn jest src/evm/rlp.test.ts --watchman=false`).

- [ ] **Step 3: Implement**

```typescript
// src/evm/rlp.ts
import { concatBytes } from '../crypto/bytes';

export type RlpInput = Uint8Array | RlpInput[];

function encodeLength(len: number, offset: number): Uint8Array {
  if (len < 56) return new Uint8Array([offset + len]);
  const hex = len.toString(16);
  const lenBytes = new Uint8Array(hex.length % 2 ? (hex.length + 1) / 2 : hex.length / 2);
  let n = len;
  for (let i = lenBytes.length - 1; i >= 0; i--) { lenBytes[i] = n & 0xff; n >>= 8; }
  return concatBytes(new Uint8Array([offset + 55 + lenBytes.length]), lenBytes);
}

export function rlpEncode(input: RlpInput): Uint8Array {
  if (input instanceof Uint8Array) {
    if (input.length === 1 && input[0] < 0x80) return input;
    return concatBytes(encodeLength(input.length, 0x80), input);
  }
  const items = input.map(rlpEncode);
  const payload = concatBytes(...items);
  return concatBytes(encodeLength(payload.length, 0xc0), payload);
}
```

- [ ] **Step 4: Run — verify PASS** (5 passing; tsc clean).

- [ ] **Step 5: Commit**

```bash
git add src/evm/rlp.ts src/evm/rlp.test.ts
git commit -m "feat: add minimal RLP encoder"
```

---

## Task 3: EIP-1559 unsigned tx encode + signing hash

**Files:** Create `src/evm/tx.ts` (partial: unsigned + hash); Test `src/evm/tx.test.ts`

`UnsignedEvmTx` fields (all amounts `bigint`, addresses `0x`-hex): `chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data`. Type-2 (EIP-1559), `accessList` always empty `[]`.

Signing payload = `0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, []])`; signing hash = `keccak256(payload)`.

- [ ] **Step 1: Write failing test**

The expected signing hash for the golden tx is computed independently by ethers (Task 4 Step 1 derivation) and pinned here. For now assert structural correctness with a deterministic check that does not need the key:

```typescript
// src/evm/tx.test.ts
import { encodeUnsignedEip1559, eip1559SigningHash, UnsignedEvmTx } from './tx';
import { hexToBytes, bytesToHex } from '../crypto/bytes';

const TX: UnsignedEvmTx = {
  chainId: 1n, nonce: 0n,
  maxPriorityFeePerGas: 1000000000n, maxFeePerGas: 20000000000n,
  gasLimit: 21000n, to: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  value: 1000000000000000n, data: '0x',
};

describe('EIP-1559 encode', () => {
  it('prefixes the envelope with 0x02', () => {
    expect(bytesToHex(encodeUnsignedEip1559(TX)).startsWith('0x02')).toBe(true);
  });
  it('signing hash is 32 bytes', () => {
    expect(hexToBytes(eip1559SigningHash(TX)).length).toBe(32);
  });
  // PINNED (Task 4 derivation): ethers gives this signing hash for TX.
  it('matches the ethers-derived signing hash', () => {
    expect(eip1559SigningHash(TX)).toBe('<PIN_SIGNING_HASH_FROM_TASK_4>');
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement (unsigned + hash portion of tx.ts)**

```typescript
// src/evm/tx.ts
import { bigIntToMinimalBytes, concatBytes, hexToBytes } from '../crypto/bytes';
import { keccak256 } from '../crypto/keccak';
import { rlpEncode, RlpInput } from './rlp';

export interface UnsignedEvmTx {
  chainId: bigint; nonce: bigint;
  maxPriorityFeePerGas: bigint; maxFeePerGas: bigint; gasLimit: bigint;
  to: string; value: bigint; data: string;
}

const TYPE_2 = new Uint8Array([0x02]);

function eip1559Fields(tx: UnsignedEvmTx): RlpInput[] {
  return [
    bigIntToMinimalBytes(tx.chainId),
    bigIntToMinimalBytes(tx.nonce),
    bigIntToMinimalBytes(tx.maxPriorityFeePerGas),
    bigIntToMinimalBytes(tx.maxFeePerGas),
    bigIntToMinimalBytes(tx.gasLimit),
    hexToBytes(tx.to),
    bigIntToMinimalBytes(tx.value),
    hexToBytes(tx.data),
    [], // accessList
  ];
}

export function encodeUnsignedEip1559(tx: UnsignedEvmTx): Uint8Array {
  return concatBytes(TYPE_2, rlpEncode(eip1559Fields(tx)));
}

export function eip1559SigningHash(tx: UnsignedEvmTx): string {
  return keccak256(encodeUnsignedEip1559(tx));
}
```

- [ ] **Step 4: Run — verify the first two tests PASS** (the pinned-hash test stays red until Task 4 pins the value; that is expected and resolved in Task 4 Step 2). tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/evm/tx.ts src/evm/tx.test.ts
git commit -m "feat: add EIP-1559 unsigned tx encoding and signing hash"
```

---

## Task 4: Golden EVM signed-tx vector (ethers oracle) + signed-tx assembler

**Files:** Modify `src/evm/tx.ts` (add assemble + txHash); Create `src/evm/evmGolden.ts`; Test `src/evm/signedTx.test.ts`

- [ ] **Step 1: Derive the golden vector with the ethers oracle (one-time)**

Run an offline ethers script (no project dep — uses `npx`) with the GOLDEN test mnemonic and the fixed `TX` from Task 3:

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
npx --yes ethers@6 -e '
const { Wallet, HDNodeWallet, Transaction } = require("ethers");
const w = HDNodeWallet.fromPhrase("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
const tx = { type:2, chainId:1, nonce:0, maxPriorityFeePerGas:1000000000n, maxFeePerGas:20000000000n, gasLimit:21000n, to:"0x9858EfFD232B4033E47d90003D41EC34EcaEda94", value:1000000000000000n, data:"0x" };
(async () => {
  const t = Transaction.from(tx);
  console.log("FROM=", w.address);
  console.log("SIGNING_HASH=", t.unsignedHash);
  const signed = await w.signTransaction(tx);
  const st = Transaction.from(signed);
  console.log("SIGNED_RAW=", signed);
  console.log("TXHASH=", st.hash);
  console.log("R=", st.signature.r, "S=", st.signature.s, "YPARITY=", st.signature.yParity);
})();
'
```
Record: `FROM` (must equal `0x9858EfFD232B4033E47d90003D41EC34EcaEda94`), `SIGNING_HASH`, `SIGNED_RAW`, `TXHASH`, and r/s/yParity. If the ethers invocation form differs, use a tiny temp script file with the same logic; the goal is the canonical signed rawTx + signature for this exact tx.

- [ ] **Step 2: Pin the vector**

Create `src/evm/evmGolden.ts`:
```typescript
import type { UnsignedEvmTx } from './tx';

// Golden EVM transaction for the standard test mnemonic (abandon…about), m/44'/60'.
// SIGNED_RAW / SIGNING_HASH / signature pinned from the ethers oracle (Task 4 Step 1).
export const EVM_GOLDEN = {
  from: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  tx: {
    chainId: 1n, nonce: 0n,
    maxPriorityFeePerGas: 1000000000n, maxFeePerGas: 20000000000n,
    gasLimit: 21000n, to: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    value: 1000000000000000n, data: '0x',
  } as UnsignedEvmTx,
  signingHash: '<PIN_SIGNING_HASH>',
  // 65-byte signature = r(32) || s(32) || yParity(1) — the shape signHash returns.
  signatureHex: '<PIN_R_S_YPARITY_HEX>',
  signedRawTx: '<PIN_SIGNED_RAW>',
  txHash: '<PIN_TXHASH>',
};
```
Build `signatureHex` = `0x` + r(64 hex, no 0x) + s(64 hex) + yParity(2 hex, `00` or `01`). Also paste the pinned `signingHash` into the Task-3 test (`<PIN_SIGNING_HASH_FROM_TASK_4>`) and confirm Task-3 tests now fully pass.

- [ ] **Step 3: Write the failing assembler test**

```typescript
// src/evm/signedTx.test.ts
import { assembleSignedEip1559, evmTxHash } from './tx';
import { EVM_GOLDEN } from './evmGolden';

describe('assembleSignedEip1559', () => {
  it('reproduces the ethers golden signed rawTx', () => {
    const raw = assembleSignedEip1559(EVM_GOLDEN.tx, EVM_GOLDEN.signatureHex);
    expect(raw).toBe(EVM_GOLDEN.signedRawTx);
  });
  it('computes the matching tx hash', () => {
    expect(evmTxHash(EVM_GOLDEN.signedRawTx)).toBe(EVM_GOLDEN.txHash);
  });
});
```

- [ ] **Step 4: Run — verify FAIL** (assembler not implemented).

- [ ] **Step 5: Implement (append to `src/evm/tx.ts`)**

```typescript
// append to src/evm/tx.ts
import { bytesToHex } from '../crypto/bytes';

// signatureHex = 0x + r(32) + s(32) + yParity(1). Returns the 0x-prefixed signed type-2 rawTx.
export function assembleSignedEip1559(tx: UnsignedEvmTx, signatureHex: string): string {
  const sig = hexToBytes(signatureHex);
  if (sig.length !== 65) throw new Error(`signature must be 65 bytes, got ${sig.length}`);
  const r = sig.slice(0, 32);
  const s = sig.slice(32, 64);
  const yParity = BigInt(sig[64]);
  const stripLeadingZeros = (b: Uint8Array) => {
    let i = 0; while (i < b.length - 1 && b[i] === 0) i++; return b.slice(i);
  };
  const fields: RlpInput[] = [
    ...eip1559Fields(tx),
    bigIntToMinimalBytes(yParity),
    stripLeadingZeros(r),
    stripLeadingZeros(s),
  ];
  return bytesToHex(concatBytes(TYPE_2, rlpEncode(fields)));
}

export function evmTxHash(signedRawTxHex: string): string {
  return keccak256(signedRawTxHex);
}
```

- [ ] **Step 6: Run — verify PASS** (signedTx + tx + the now-pinned Task-3 hash test all green; tsc clean).

- [ ] **Step 7: Commit**

```bash
git add src/evm/tx.ts src/evm/tx.test.ts src/evm/evmGolden.ts src/evm/signedTx.test.ts
git commit -m "feat: assemble signed EIP-1559 tx; pin ethers golden vector"
```

---

## Task 5: SigningChainAdapter + EvmSigningAdapter (build / sign / broadcast)

**Files:** Create `src/chain-adapter/signing-types.ts`, `src/chain-adapter/EvmSigningAdapter.ts`; Test `src/chain-adapter/EvmSigningAdapter.test.ts`

- [ ] **Step 1: Add `signHash` to the Jest bridge mock if absent**

Confirm `src/native-bridge/__mocks__/NativeSecureKeyring.ts` exposes `signHash` as a `jest.fn()`. (It was added in Phase 0; verify with `grep signHash src/native-bridge/__mocks__/NativeSecureKeyring.ts`. If missing, add `signHash: jest.fn(async () => '0x' + '00'.repeat(65))`.)

- [ ] **Step 2: Write failing test**

```typescript
// src/chain-adapter/EvmSigningAdapter.test.ts
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { EvmSigningAdapter } from './EvmSigningAdapter';
import { EVM_GOLDEN } from '../evm/evmGolden';
import type { ChainConfig } from '../chain-registry/types';

const ETH: ChainConfig = {
  caip2: 'eip155:1', coinType: 60, family: 'evm', name: 'Ethereum', nativeSymbol: 'ETH',
  decimals: 18, rpc: { primary: 'https://rpc', fallback: [] }, explorerTx: 'https://e/',
  capabilities: { dapp: true, nft: true, defi: true },
};

describe('EvmSigningAdapter', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());

  it('builds an EIP-1559 tx, filling nonce + fees from RPC', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x0' }) })                 // nonce
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x3b9aca00' }) })          // maxPriorityFeePerGas = 1 gwei
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { baseFeePerGas: '0x4a817c800' } }) }); // base fee ~20 gwei
    const a = new EvmSigningAdapter(ETH);
    const tx = await a.buildTransaction({ from: EVM_GOLDEN.from, to: EVM_GOLDEN.from, value: 1000000000000000n });
    expect(tx.chainId).toBe(1n);
    expect(tx.nonce).toBe(0n);
    expect(tx.gasLimit).toBe(21000n);          // native transfer default
    expect(tx.maxFeePerGas).toBeGreaterThan(tx.maxPriorityFeePerGas);
  });

  it('signs via the signHash bridge and assembles the golden rawTx', async () => {
    (SecureKeyring.signHash as jest.Mock).mockResolvedValue(EVM_GOLDEN.signatureHex);
    const a = new EvmSigningAdapter(ETH);
    const raw = await a.sign(EVM_GOLDEN.tx, 'wref');
    expect(SecureKeyring.signHash).toHaveBeenCalledWith('wref', 60, EVM_GOLDEN.signingHash);
    expect(raw).toBe(EVM_GOLDEN.signedRawTx);
  });

  it('broadcasts via eth_sendRawTransaction', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: EVM_GOLDEN.txHash }) });
    const a = new EvmSigningAdapter(ETH);
    const hash = await a.broadcast(EVM_GOLDEN.signedRawTx);
    expect(hash).toBe(EVM_GOLDEN.txHash);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.method).toBe('eth_sendRawTransaction');
    expect(body.params).toEqual([EVM_GOLDEN.signedRawTx]);
  });
});
```

- [ ] **Step 3: Run — verify FAIL.**

- [ ] **Step 4: Implement the interface**

```typescript
// src/chain-adapter/signing-types.ts
import type { ReadOnlyChainAdapter } from './types';
import type { UnsignedEvmTx } from '../evm/tx';

export interface TxRequest { from: string; to: string; value: bigint; data?: string; gasLimit?: bigint; }

export interface SigningChainAdapter extends ReadOnlyChainAdapter {
  buildTransaction(req: TxRequest): Promise<UnsignedEvmTx>;
  sign(tx: UnsignedEvmTx, walletRef: string): Promise<string>;     // -> signed rawTx hex
  broadcast(signedRawTx: string): Promise<string>;                 // -> tx hash
}
```

- [ ] **Step 5: Implement the adapter**

```typescript
// src/chain-adapter/EvmSigningAdapter.ts
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import type { ChainConfig } from '../chain-registry/types';
import { jsonRpc } from '../net/jsonRpc';
import { EvmAdapter } from './EvmAdapter';
import type { SigningChainAdapter, TxRequest } from './signing-types';
import { assembleSignedEip1559, eip1559SigningHash, UnsignedEvmTx } from '../evm/tx';

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
}
```

- [ ] **Step 6: Run — verify PASS** (3 passing; tsc clean). Update `getAdapter` if you want signing adapters returned for EVM, OR keep `getAdapter` read-only and add a `getSigningAdapter(config)` — to avoid breaking Phase-1 read-only consumers, add a separate factory:

```typescript
// append to src/chain-adapter/getAdapter.ts
import { EvmSigningAdapter } from './EvmSigningAdapter';
import type { SigningChainAdapter } from './signing-types';
export function getSigningAdapter(config: ChainConfig): SigningChainAdapter {
  if (config.family === 'evm') return new EvmSigningAdapter(config);
  throw new Error(`no signing adapter yet for family: ${config.family}`); // TRON = Phase 3
}
```
Add a test in `EvmSigningAdapter.test.ts`: `expect(getSigningAdapter(ETH)).toBeInstanceOf(EvmSigningAdapter)`.

- [ ] **Step 7: Commit**

```bash
git add src/chain-adapter/signing-types.ts src/chain-adapter/EvmSigningAdapter.ts src/chain-adapter/getAdapter.ts src/chain-adapter/EvmSigningAdapter.test.ts
git commit -m "feat: add SigningChainAdapter + EvmSigningAdapter (build/sign/broadcast)"
```

---

## Task 6: EVM personal_sign message signing

**Files:** Modify `src/evm/tx.ts` (or new `src/evm/message.ts`); Test `src/evm/message.test.ts`

`personal_sign` hash = `keccak256("\x19Ethereum Signed Message:\n" + len(message) + message)`, then `signHash` → 65-byte signature returned as `0x`-hex (r||s||v with v = 27 + yParity for eth_personal_sign compatibility).

- [ ] **Step 1: Write failing test** (pin the prefixed hash with ethers oracle for a fixed message)

Derive once: `npx --yes ethers@6 -e 'const {hashMessage,id}=require("ethers"); console.log(hashMessage("hello tronlink"))'` → pin as `<PIN_MSG_HASH>`.
```typescript
// src/evm/message.test.ts
import { personalSignHash, toEthSignatureV } from './message';

describe('personal_sign', () => {
  it('computes the EIP-191 prefixed hash (ethers parity)', () => {
    expect(personalSignHash('hello tronlink')).toBe('<PIN_MSG_HASH>');
  });
  it('converts a 65-byte 0/1 yParity signature to v=27/28', () => {
    const sig = '0x' + 'ab'.repeat(32) + 'cd'.repeat(32) + '00';
    expect(toEthSignatureV(sig).endsWith('1b')).toBe(true); // 27
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement**

```typescript
// src/evm/message.ts
import { concatBytes, hexToBytes, bytesToHex } from '../crypto/bytes';
import { keccak256 } from '../crypto/keccak';

export function personalSignHash(message: string): string {
  const msg = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msg.length}`);
  return keccak256(concatBytes(prefix, msg));
}

// signHash returns r||s||yParity(0/1); Ethereum personal_sign expects v = 27/28.
export function toEthSignatureV(signatureHex: string): string {
  const sig = hexToBytes(signatureHex);
  if (sig.length !== 65) throw new Error('expected 65-byte signature');
  const v = 27 + sig[64];
  return bytesToHex(concatBytes(sig.slice(0, 64), new Uint8Array([v])));
}
```

- [ ] **Step 4: Run — verify PASS; tsc clean.**

- [ ] **Step 5: Add `personalSign` to the adapter** (append to `EvmSigningAdapter.ts`):
```typescript
import { personalSignHash, toEthSignatureV } from '../evm/message';
// inside the class:
async personalSign(message: string, walletRef: string): Promise<string> {
  const sig = await SecureKeyring.signHash(walletRef, this.config.coinType, personalSignHash(message));
  return toEthSignatureV(sig);
}
```
Add it to the `SigningChainAdapter` interface (`personalSign(message: string, walletRef: string): Promise<string>`) and a test asserting it calls signHash with the prefixed hash and returns a v=27/28 signature.

- [ ] **Step 6: Commit**

```bash
git add src/evm/message.ts src/evm/message.test.ts src/chain-adapter/EvmSigningAdapter.ts src/chain-adapter/signing-types.ts src/chain-adapter/EvmSigningAdapter.test.ts
git commit -m "feat: add EVM personal_sign (EIP-191) message signing"
```

---

## Task 7: EVM request router (pure, testable)

The router contains all DApp method-handling logic with NO WebView/React, so it is unit-testable. The WebView host (Task 8) only wires transport.

**Files:** Create `src/dapp/evmRequestRouter.ts`, `src/evm/providerProtocol.ts`; Test `src/dapp/evmRequestRouter.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/dapp/evmRequestRouter.test.ts
import { handleEvmRequest, EvmDappContext } from './evmRequestRouter';
import { jsonRpc } from '../net/jsonRpc';
jest.mock('../net/jsonRpc');

const ctx: EvmDappContext = {
  address: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  chainIdHex: '0x1',
  config: { caip2: 'eip155:1', rpc: { primary: 'https://rpc', fallback: [] } } as any,
  walletRef: 'wref',
  signTransaction: jest.fn(async () => '0xsignedraw'),
  broadcast: jest.fn(async () => '0xtxhash'),
  personalSign: jest.fn(async () => '0xsig'),
  confirm: jest.fn(async () => true),
};

describe('handleEvmRequest', () => {
  it('returns the account for eth_requestAccounts/eth_accounts', async () => {
    await expect(handleEvmRequest('eth_requestAccounts', [], ctx)).resolves.toEqual([ctx.address]);
    await expect(handleEvmRequest('eth_accounts', [], ctx)).resolves.toEqual([ctx.address]);
  });
  it('returns chainId and net_version', async () => {
    await expect(handleEvmRequest('eth_chainId', [], ctx)).resolves.toBe('0x1');
    await expect(handleEvmRequest('net_version', [], ctx)).resolves.toBe('1');
  });
  it('signs + broadcasts eth_sendTransaction (after confirm)', async () => {
    const hash = await handleEvmRequest('eth_sendTransaction', [{ to: ctx.address, value: '0x1' }], ctx);
    expect(ctx.confirm).toHaveBeenCalled();
    expect(ctx.signTransaction).toHaveBeenCalled();
    expect(ctx.broadcast).toHaveBeenCalledWith('0xsignedraw');
    expect(hash).toBe('0xtxhash');
  });
  it('rejects eth_sendTransaction when the user declines', async () => {
    const decline = { ...ctx, confirm: jest.fn(async () => false) };
    await expect(handleEvmRequest('eth_sendTransaction', [{ to: ctx.address, value: '0x1' }], decline))
      .rejects.toMatchObject({ code: 4001 });
  });
  it('routes personal_sign to the signer', async () => {
    await expect(handleEvmRequest('personal_sign', ['0x68656c6c6f', ctx.address], ctx)).resolves.toBe('0xsig');
  });
  it('forwards unknown read methods to RPC', async () => {
    (jsonRpc as jest.Mock).mockResolvedValue('0xdead');
    await expect(handleEvmRequest('eth_blockNumber', [], ctx)).resolves.toBe('0xdead');
    expect(jsonRpc).toHaveBeenCalledWith(ctx.config.rpc, 'eth_blockNumber', []);
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement protocol + router**

```typescript
// src/evm/providerProtocol.ts
export interface ProviderRequest { id: number; method: string; params: unknown[]; }
export interface ProviderResponse { id: number; result?: unknown; error?: { code: number; message: string }; }
export class ProviderRpcError extends Error {
  constructor(public code: number, message: string) { super(message); }
}
```

```typescript
// src/dapp/evmRequestRouter.ts
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
      // params: [data, address]
      const data: string = params[0];
      const msg = data?.startsWith('0x') ? hexToText(data) : data;
      const ok = await ctx.confirm(`Sign message: ${msg}`);
      if (!ok) throw new ProviderRpcError(4001, 'User rejected the request');
      return ctx.personalSign(msg);
    }
    case 'eth_signTypedData_v4':
      throw new ProviderRpcError(4200, 'eth_signTypedData_v4 not supported yet (Phase 4)');
    default:
      // Read-only passthrough to the chain RPC.
      return jsonRpc(ctx.config.rpc as any, method, params);
  }
}
```

- [ ] **Step 4: Run — verify PASS (6+ passing); tsc clean.**

- [ ] **Step 5: Commit**

```bash
git add src/dapp/evmRequestRouter.ts src/evm/providerProtocol.ts src/dapp/evmRequestRouter.test.ts
git commit -m "feat: add EVM DApp request router (read passthrough + sign/send/personal_sign)"
```

---

## Task 8: WebView host + injected EIP-1193 provider

**Files:** Create `src/evm/provider-inject.ts`, `src/dapp/EvmDappWebView.tsx`; Test `src/evm/provider-inject.test.ts`

- [ ] **Step 1: Add the dependency**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn && yarn add react-native-webview && (cd ios && pod install)
```
Expected: react-native-webview installed + autolinked (iOS pod added).

- [ ] **Step 2: Write the provider-script test** (the script is produced by a function; assert it contains the EIP-1193 surface and embeds the chain/address)

```typescript
// src/evm/provider-inject.test.ts
import { buildEthereumProviderScript } from './provider-inject';

describe('buildEthereumProviderScript', () => {
  const s = buildEthereumProviderScript({ address: '0xabc', chainIdHex: '0x1' });
  it('defines window.ethereum with EIP-1193 surface', () => {
    expect(s).toContain('window.ethereum');
    expect(s).toContain('request');
    expect(s).toContain('eip6963:announceProvider'); // basic 6963 announce (single provider; dual = Phase 4)
    expect(s).toContain('isMetaMask'); // compat flag many dapps check
  });
  it('embeds the injected address + chainId', () => {
    expect(s).toContain('0xabc');
    expect(s).toContain('0x1');
  });
});
```

- [ ] **Step 3: Run — verify FAIL.**

- [ ] **Step 4: Implement the injected script**

```typescript
// src/evm/provider-inject.ts
export interface ProviderInit { address: string; chainIdHex: string; }

// Returns a JS string injected into the WebView before page load. It defines an
// EIP-1193 window.ethereum that proxies request() to the RN host via postMessage,
// and resolves responses delivered back through window.__tlOnResponse.
export function buildEthereumProviderScript(init: ProviderInit): string {
  return `(function(){
  var ADDRESS = ${JSON.stringify(init.address)};
  var CHAIN_ID = ${JSON.stringify(init.chainIdHex)};
  var pending = {}; var nextId = 1;
  var listeners = {};
  function emit(ev, data){ (listeners[ev]||[]).forEach(function(f){ try{ f(data);}catch(e){} }); }
  window.__tlOnResponse = function(resp){
    var p = pending[resp.id]; if(!p) return; delete pending[resp.id];
    if(resp.error){ var e = new Error(resp.error.message); e.code = resp.error.code; p.reject(e); }
    else p.resolve(resp.result);
  };
  window.__tlEmit = function(ev, data){
    if(ev==='chainChanged'){ CHAIN_ID = data; }
    if(ev==='accountsChanged'){ ADDRESS = (data&&data[0])||ADDRESS; }
    emit(ev, data);
  };
  var provider = {
    isMetaMask: true,
    isTronLink: true,
    chainId: CHAIN_ID,
    selectedAddress: ADDRESS,
    request: function(args){
      var id = nextId++;
      return new Promise(function(resolve, reject){
        pending[id] = { resolve: resolve, reject: reject };
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, method: args.method, params: args.params||[] }));
      });
    },
    on: function(ev, cb){ (listeners[ev]=listeners[ev]||[]).push(cb); return provider; },
    removeListener: function(ev, cb){ listeners[ev]=(listeners[ev]||[]).filter(function(f){return f!==cb;}); return provider; },
    enable: function(){ return provider.request({ method: 'eth_requestAccounts' }); }
  };
  // legacy send/sendAsync shims
  provider.send = function(m, p){ return provider.request({ method: m, params: p }); };
  provider.sendAsync = function(payload, cb){
    provider.request(payload).then(function(r){ cb(null,{ id: payload.id, jsonrpc:'2.0', result: r }); })
      .catch(function(e){ cb(e); });
  };
  window.ethereum = provider;
  function announce(){
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
      detail: Object.freeze({ info: { uuid: '6e1f2d2a-tlrn', name: 'TronLink', icon: 'data:image/svg+xml,', rdns: 'org.tronlink' }, provider: provider })
    }));
  }
  window.addEventListener('eip6963:requestProvider', announce); announce();
  window.dispatchEvent(new Event('ethereum#initialized'));
})(); true;`;
}
```

- [ ] **Step 5: Implement the WebView host** (wiring only; logic lives in the router)

```tsx
// src/dapp/EvmDappWebView.tsx
import React, { useRef } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { buildEthereumProviderScript } from '../evm/provider-inject';
import { handleEvmRequest, EvmDappContext } from './evmRequestRouter';
import type { ProviderResponse } from '../evm/providerProtocol';

export function EvmDappWebView({ uri, ctx }: { uri: string; ctx: EvmDappContext }) {
  const ref = useRef<WebView>(null);
  const injected = buildEthereumProviderScript({ address: ctx.address, chainIdHex: ctx.chainIdHex });

  const onMessage = async (e: WebViewMessageEvent) => {
    let req: { id: number; method: string; params: any[] };
    try { req = JSON.parse(e.nativeEvent.data); } catch { return; }
    const resp: ProviderResponse = { id: req.id };
    try { resp.result = await handleEvmRequest(req.method, req.params || [], ctx); }
    catch (err: any) { resp.error = { code: err?.code ?? -32603, message: err?.message ?? 'error' }; }
    ref.current?.injectJavaScript(`window.__tlOnResponse(${JSON.stringify(resp)}); true;`);
  };

  return (
    <WebView
      ref={ref}
      source={{ uri }}
      injectedJavaScriptBeforeContentLoaded={injected}
      onMessage={onMessage}
    />
  );
}
```

- [ ] **Step 6: Run — verify PASS** (`yarn jest src/evm/provider-inject.test.ts --watchman=false`; full `yarn jest --watchman=false` still green; `yarn tsc --noEmit` clean). The `.tsx` host is verified by compile + the on-device capstone (Task 9); its logic is already covered by the router tests.

- [ ] **Step 7: Commit**

```bash
git add package.json yarn.lock ios/Podfile.lock src/evm/provider-inject.ts src/dapp/EvmDappWebView.tsx src/evm/provider-inject.test.ts
git commit -m "feat: add EVM WebView host + injected EIP-1193 provider"
```

---

## Task 9: On-device capstone — golden signed-tx parity + live DApp provider

**Files:** Create `src/devtools/EvmSignSelfTest.ts`, `assets/dapp-selftest.html`; Modify `App.tsx`

- [ ] **Step 1: Sign-parity self-test** (build the golden tx → sign via the LIVE bridge → must equal the ethers-pinned rawTx, both platforms; zero funds, no broadcast)

```typescript
// src/devtools/EvmSignSelfTest.ts
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { GOLDEN } from '../crypto/goldenVectors';
import { EVM_GOLDEN } from '../evm/evmGolden';
import { eip1559SigningHash, assembleSignedEip1559 } from '../evm/tx';

export type Line = { name: string; ok: boolean; detail: string };

export async function runEvmSignSelfTest(): Promise<Line[]> {
  const out: Line[] = [];
  const ref = await SecureKeyring.importMnemonic(GOLDEN.mnemonic);
  const hash = eip1559SigningHash(EVM_GOLDEN.tx);
  out.push({ name: 'signing hash', ok: hash === EVM_GOLDEN.signingHash, detail: hash });
  const sig = await SecureKeyring.signHash(ref, 60, hash);     // real TWCore signature
  const raw = assembleSignedEip1559(EVM_GOLDEN.tx, sig);
  out.push({ name: 'signed rawTx == ethers golden', ok: raw === EVM_GOLDEN.signedRawTx, detail: raw.slice(0, 24) + '…' });
  await SecureKeyring.deleteWallet(ref);
  return out;
}
```

- [ ] **Step 2: Wire into App.tsx** (add a third auto-run probe, logging `EVMSIGN_*` sentinels — same pattern as the existing probes; `EVMSIGN_RESULT=ALL_PASS` derived from `lines.every(l=>l.ok)`).

- [ ] **Step 3: Keep Jest + tsc green** (`yarn jest --watchman=false` all suites pass; `yarn tsc --noEmit` clean). The bridge mock's `signHash` returns a fixed value in tests, so the App-render test won't match golden — that's fine (App render test only renders; it does not assert golden).

- [ ] **Step 4: Android device verification**

```bash
adb logcat -c
npx react-native run-android   # Metro running
sleep 20
adb logcat -d | grep -E "EVMSIGN_" | tail
```
Expected: `EVMSIGN_LINE PASS signing hash | 0x…`, `EVMSIGN_LINE PASS signed rawTx == ethers golden | 0x02…`, `EVMSIGN_RESULT=ALL_PASS`. This proves TS-built EIP-1559 + native `signHash` + TS-assembled rawTx reproduces the canonical ethers signature on Android.

- [ ] **Step 5: iOS device verification**

```bash
npx react-native start --client-logs > /tmp/metro.log 2>&1 &
npx react-native run-ios --simulator "iPhone 17 Pro"
sleep 30
grep -E "EVMSIGN_" /tmp/metro.log | tail
```
Expected: same `EVMSIGN_RESULT=ALL_PASS`.

- [ ] **Step 6: Live DApp provider smoke** (manual, both platforms)

Create `assets/dapp-selftest.html` — a minimal page that, on load, calls `window.ethereum.request({method:'eth_requestAccounts'})`, `eth_chainId`, and `personal_sign`, rendering each result into the DOM. Temporarily render `EvmDappWebView` (uri pointing at a bundled/local copy of this page, or a hosted gist) with a real `EvmDappContext` (address from `buildAccountTree`, `signTransaction`/`broadcast`/`personalSign` wired to `EvmSigningAdapter`, `confirm` auto-true for the smoke). Confirm on each platform: the page shows the golden EVM address for `eth_requestAccounts`, `0x1` for `eth_chainId`, and a 0x… signature for `personal_sign`. Capture a screenshot/log. (This is a manual UI smoke; the routing logic is already unit-tested in Task 7.)

- [ ] **Step 7: Commit** (after EVMSIGN_RESULT=ALL_PASS on both platforms)

```bash
git add src/devtools/EvmSignSelfTest.ts assets/dapp-selftest.html App.tsx
git commit -m "test: on-device EVM signed-tx golden parity + DApp provider smoke"
```

---

## Task 10: Phase-2 exit gate documentation

**Files:** Create `docs/phase2-evm.md`

- [ ] **Step 1: Write the doc** capturing: the signing approach (TS RLP/keccak + native `signHash`, no bridge changes), the pinned EVM golden vector (tx params, signing hash, signed rawTx, txHash — ethers-derived), exit criteria + evidence, the provider's supported methods + what's deferred (`eth_signTypedData_v4`, full connect UX, dual `window.tron` → Phase 4), broadcast caveat (works; on-device real broadcast needs a funded testnet account — optional), and the Phase-2→Phase-3 handoff (TRON write path with §5 dual-signing).

Exit criteria (all ✅):
1. Full Jest suite passes (crypto/bytes/keccak, rlp, tx, signedTx, EvmSigningAdapter, message, evmRequestRouter, provider-inject + all prior).
2. `yarn tsc --noEmit` clean.
3. On-device `EVMSIGN_RESULT=ALL_PASS` on both iOS and Android (TS-built + native-signed rawTx == ethers golden).
4. DApp provider smoke on both platforms: `eth_requestAccounts` → golden address, `eth_chainId` → `0x1`, `personal_sign` → signature.

- [ ] **Step 2: Commit**

```bash
git add docs/phase2-evm.md
git commit -m "docs: record Phase-2 EVM full-path exit gate"
```

---

## Self-Review

**Spec coverage (architecture §4.1 full ChainAdapter, §6.1 EVM flow, §9 Phase 2):**
- `buildTransaction` (nonce/gas EIP-1559 via JSON-RPC) → Task 5. ✅
- `sign` (signing in native; private key never in JS) → Tasks 3/4/5 via `signHash` (hash-only crosses bridge). ✅
- `broadcast` (`eth_sendRawTransaction`) → Task 5. ✅
- message signing (`personal_sign`) → Task 6. ✅
- EVM WebView provider (`window.ethereum`, EIP-1193, basic 6963) + request routing → Tasks 7/8. ✅
- determinism/correctness gate → ethers-oracle golden signed-tx vector, asserted in Jest (Task 4) and on-device both platforms (Task 9). ✅
- Deferred & labeled: `eth_signTypedData_v4`, full connect/approval UX, dual `window.tron`, TRON signing → Phase 3/4. ✅ (scoped)

**No private key over the bridge:** the only signing call is `SecureKeyring.signHash(walletRef, 60, keccakHash)` — a 32-byte public hash in, a 65-byte signature out. The full RLP/tx assembly is public data in TS. Invariant preserved. ✅

**Placeholder scan:** Real code in every step. The `<PIN_*>` markers (signing hash, signature, signed rawTx, msg hash) are verify-and-pin slots with an exact ethers derivation command (Task 4 Step 1, Task 6 Step 1) — deterministic, independently checkable, not lazy gaps. The only deferred features are explicitly scoped to later phases.

**Type consistency:** `UnsignedEvmTx` (Task 3) is consumed unchanged by `assembleSignedEip1559` (Task 4), `EvmSigningAdapter.sign`/`buildTransaction` (Task 5), and the sign self-test (Task 9). `signatureHex` is the 65-byte `r||s||yParity` shape produced by `SecureKeyring.signHash` and consumed by `assembleSignedEip1559` + `toEthSignatureV`. `SigningChainAdapter extends ReadOnlyChainAdapter` (Task 5) adds `buildTransaction`/`sign`/`broadcast`/`personalSign`; `EvmSigningAdapter extends EvmAdapter` so the Phase-1 read methods are inherited. `EvmDappContext` (Task 7) is consumed by `EvmDappWebView` (Task 8) and the capstone (Task 9). `ProviderResponse`/`ProviderRpcError` (Task 7) used by the host (Task 8) and provider script protocol. `jsonRpc(endpoints, method, params)` and `config.rpc` shapes match Phase-1.
