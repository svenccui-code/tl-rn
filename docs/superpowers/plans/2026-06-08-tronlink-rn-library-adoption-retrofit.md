# TronLink RN — Library Adoption Retrofit (viem + tronweb) + §5 Closure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the project's hand-rolled crypto/encoding with established libraries — **viem** for EVM, **tronweb** for TRON — keeping the native `signHash` signing model, preserving every golden-vector assertion, and closing the Phase-3 §5 CRITICAL (tronweb builds `raw_data` client-side from our params, so the signed bytes encode our intent by construction; no node-JSON trust, no hand-rolled protobuf decoder).

**Architecture (unchanged where it matters):** Private key stays native; viem/tronweb are used ONLY to build transactions, compute signing hashes/txIDs, and serialize — the signature comes from `SecureKeyring.signHash` and is injected back into the library's serializer (`serializeTransaction(tx, signature)` for viem; `tx.signature = [hex]` for tronweb). All existing golden vectors (`EVM_GOLDEN`, `tronGolden`) remain the acceptance bar — the libraries must reproduce them.

**Validated by spike** (branch `spike/libs-rn-validation`, commit `b78f03e`): viem 2.52.2 (zero polyfills) and tronweb 6.3.0 (2 polyfills) both run in Hermes on iOS + Android and reproduce the golden vectors. This plan applies the validated recipe on a clean branch.

**Tech Stack:** viem · tronweb · `react-native-get-random-values` + `buffer` (polyfills) · the native `signHash` bridge · Jest. Removes: hand-rolled `src/evm/{rlp,tx,message}.ts`, `src/chain-adapter/abi.ts`, `src/tron/{txId,address,build}.ts` (where libs cover them) and the **`ethers` runtime dependency** (was added by mistake; only ever needed as an offline oracle).

**Builds on / supersedes hand-rolled code from:** Phase 2 (EVM) and Phase 3 (TRON). Replaces the pending hand-rolled-protobuf §5 plan (`2026-06-08-...trustless-rawdata.md`) — that approach is dropped in favor of tronweb local construction.

**Scope discipline:** behavior-preserving retrofit. No new product features. Each retrofit task swaps an implementation and re-runs the EXISTING golden test (updated only where the lib's API shape differs). Deleting a hand-rolled module is done only after its consumers compile + its golden test passes against the lib.

---

## Polyfill recipe (validated in spike)

- `index.js` line 1: `import 'react-native-get-random-values';`
- `index.js` next: `import { Buffer } from 'buffer'; global.Buffer = global.Buffer || Buffer;`
- `metro.config.js` resolver: `extraNodeModules: { buffer: require.resolve('buffer'), stream: require.resolve('stream-browserify') }`
- deps: `viem`, `tronweb`, `react-native-get-random-values`, `buffer`, `stream-browserify`; then `cd ios && pod install` (links `react-native-get-random-values`).

---

## Task 1: Land validated library infrastructure

**Files:** `package.json`, `index.js`, `metro.config.js`, `ios/Podfile.lock`

- [ ] **Step 1: Branch + add deps**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
git checkout main && git checkout -b retrofit/viem-tronweb
yarn add viem tronweb react-native-get-random-values buffer stream-browserify
(cd ios && pod install)
```

- [ ] **Step 2: Wire polyfills** — apply the recipe above to `index.js` (top) and `metro.config.js` (resolver `extraNodeModules`).

- [ ] **Step 3: Remove the mistaken `ethers` runtime dependency**

```bash
yarn remove ethers
grep -rn "from 'ethers'\|require('ethers')" src/ || echo "no ethers imports in src (OK to remove)"
```
If any `src/` file imports `ethers`, STOP and report (it should be none — ethers was only ever an `npx` oracle). ethers stays available via `npx ethers@6` for golden derivation if ever needed.

- [ ] **Step 4: Smoke — Metro bundles + full suite still green**

Run: `yarn jest --watchman=false 2>&1 | tail -4` (all prior tests pass — nothing swapped yet) and `yarn tsc --noEmit` (clean). Then `npx react-native run-android` once to confirm the polyfilled bundle boots (the existing self-tests still log ALL_PASS).

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock index.js metro.config.js ios/Podfile.lock
git commit -m "build: add viem + tronweb + RN polyfills; drop ethers runtime dep"
```

---

## Task 2: EVM tx encode/hash/serialize via viem

Replace hand-rolled `src/evm/{rlp,tx}.ts` with a thin viem-backed module. Keep the `UnsignedEvmTx` type + `EVM_GOLDEN` assertions.

**Files:** Create `src/evm/viemTx.ts`; rewrite `src/evm/tx.ts` to re-export from viem-backed impl (or update consumers); Test rewrite `src/evm/tx.test.ts` + `src/evm/signedTx.test.ts`

- [ ] **Step 1: Write the (updated) failing test** — same golden assertions, viem-backed functions

```typescript
// src/evm/tx.test.ts (viem-backed; same golden bar)
import { eip1559SigningHash, assembleSignedEip1559, evmTxHash, UnsignedEvmTx } from './tx';
import { EVM_GOLDEN } from './evmGolden';

describe('EVM tx (viem-backed)', () => {
  it('signing hash matches the golden', () => {
    expect(eip1559SigningHash(EVM_GOLDEN.tx)).toBe(EVM_GOLDEN.signingHash);
  });
  it('assembles the golden signed rawTx from the golden signature', () => {
    expect(assembleSignedEip1559(EVM_GOLDEN.tx, EVM_GOLDEN.signatureHex)).toBe(EVM_GOLDEN.signedRawTx);
  });
  it('computes the golden tx hash', () => {
    expect(evmTxHash(EVM_GOLDEN.signedRawTx)).toBe(EVM_GOLDEN.txHash);
  });
});
```

- [ ] **Step 2: Run — verify it still passes with the OLD impl** (baseline), then proceed to swap.

- [ ] **Step 3: Reimplement `src/evm/tx.ts` on viem** (keep the SAME exported signatures so consumers/tests are unchanged)

```typescript
// src/evm/tx.ts (viem-backed)
import { serializeTransaction, keccak256, type TransactionSerializableEIP1559, type Hex } from 'viem';

export interface UnsignedEvmTx {
  chainId: bigint; nonce: bigint;
  maxPriorityFeePerGas: bigint; maxFeePerGas: bigint; gasLimit: bigint;
  to: string; value: bigint; data: string;
}

function toViem(tx: UnsignedEvmTx): TransactionSerializableEIP1559 {
  return {
    type: 'eip1559',
    chainId: Number(tx.chainId),
    nonce: Number(tx.nonce),
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    maxFeePerGas: tx.maxFeePerGas,
    gas: tx.gasLimit,
    to: tx.to as Hex,
    value: tx.value,
    data: (tx.data || '0x') as Hex,
  };
}

export function eip1559SigningHash(tx: UnsignedEvmTx): string {
  return keccak256(serializeTransaction(toViem(tx)));
}

// signatureHex = 0x + r(32) + s(32) + yParity(1) — the shape signHash returns.
export function assembleSignedEip1559(tx: UnsignedEvmTx, signatureHex: string): string {
  const h = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex;
  if (h.length !== 130) throw new Error(`signature must be 65 bytes, got ${h.length / 2}`);
  const r = ('0x' + h.slice(0, 64)) as Hex;
  const s = ('0x' + h.slice(64, 128)) as Hex;
  const yParity = parseInt(h.slice(128, 130), 16);
  return serializeTransaction(toViem(tx), { r, s, yParity });
}

export function evmTxHash(signedRawTxHex: string): string {
  return keccak256(signedRawTxHex as Hex);
}
```
Delete `src/evm/rlp.ts` + `src/evm/rlp.test.ts` (viem owns serialization now).

- [ ] **Step 4: Run — verify PASS** (`yarn jest src/evm/tx.test.ts src/evm/signedTx.test.ts --watchman=false` → green against EVM_GOLDEN; full suite minus the deleted rlp test; `yarn tsc --noEmit` clean). Fix any consumer imports.

- [ ] **Step 5: Commit**

```bash
git add src/evm/tx.ts src/evm/tx.test.ts src/evm/signedTx.test.ts
git rm src/evm/rlp.ts src/evm/rlp.test.ts
git commit -m "refactor(evm): serialize EIP-1559 tx via viem (drop hand-rolled RLP)"
```

---

## Task 3: EVM ABI + keccak + message via viem

**Files:** rewrite `src/chain-adapter/abi.ts` + `src/evm/message.ts` on viem; reassess `src/crypto/keccak.ts`

- [ ] **Step 1: Reimplement `src/chain-adapter/abi.ts`** using viem
```typescript
import { encodeFunctionData, decodeAbiParameters, parseAbiParameters, type Hex } from 'viem';

export function erc20BalanceOfData(address: string): string {
  return encodeFunctionData({
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view',
            inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }],
    functionName: 'balanceOf', args: [address as Hex],
  });
}
export function decodeUint256(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return decodeAbiParameters(parseAbiParameters('uint256'), hex as Hex)[0] as bigint;
}
```
Keep `src/chain-adapter/abi.test.ts` (same vectors — viem must reproduce the `0x70a08231...` encoding + uint256 decode).

- [ ] **Step 2: Reimplement `src/evm/message.ts`** using viem
```typescript
import { hashMessage, type Hex } from 'viem';
export function personalSignHash(message: string): string { return hashMessage(message); }
export function toEthSignatureV(signatureHex: string): string {
  const h = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex;
  if (h.length !== 130) throw new Error('expected 65-byte signature');
  const v = (27 + parseInt(h.slice(128, 130), 16)).toString(16).padStart(2, '0');
  return '0x' + h.slice(0, 128) + v;
}
```
Keep `message.test.ts` (golden personal_sign hash bar).

- [ ] **Step 3: `src/crypto/keccak.ts`** — re-export viem's keccak256 to remove the direct `@noble/hashes/sha3` use (`export { keccak256 } from 'viem';`). Keep `keccak.test.ts` (empty-input constant). Keep `src/crypto/bytes.ts` (still used by TRON + tests). Decide on `@noble/hashes`: keep it (tronweb/viem pull it transitively; TRON sha256 path may still use it — see Task 5).

- [ ] **Step 4: Run — verify PASS** (abi, message, keccak tests green; full suite; tsc clean).

- [ ] **Step 5: Commit**

```bash
git add src/chain-adapter/abi.ts src/evm/message.ts src/crypto/keccak.ts
git commit -m "refactor(evm): ABI encode/decode, personal_sign, keccak via viem"
```

---

## Task 4: Rewire EvmSigningAdapter + re-validate EVM end-to-end

**Files:** `src/chain-adapter/EvmSigningAdapter.ts` (imports only — its logic already calls `eip1559SigningHash`/`assembleSignedEip1559`); run its golden test.

- [ ] **Step 1:** Confirm `EvmSigningAdapter` + `EvmAdapter` compile against the viem-backed `tx.ts`/`abi.ts`/`message.ts` (signatures unchanged → no logic change expected). Run `yarn jest src/chain-adapter/EvmSigningAdapter.test.ts src/chain-adapter/EvmAdapter.test.ts --watchman=false` → green (still asserts `EVM_GOLDEN.signedRawTx` via the bridge mock).
- [ ] **Step 2:** Full suite + tsc clean. Commit (if any import tweaks): `git commit -am "refactor(evm): point signing adapter at viem-backed encoders"` (skip if no changes needed).

---

## Task 5: TRON address + txID via tronweb

**Files:** rewrite `src/tron/address.ts` + `src/tron/txId.ts` on tronweb; keep tests (golden bar)

- [ ] **Step 1: Reimplement** using tronweb's offline utils (validated in spike)
```typescript
// src/tron/address.ts
import { TronWeb } from 'tronweb';
export function tronAddressToHex(base58: string): string {
  const hex = TronWeb.address.toHex(base58);          // throws on bad checksum
  if (!/^41[0-9a-f]{40}$/i.test(hex)) throw new Error(`bad TRON address: ${base58}`);
  return hex.toLowerCase();
}
export function hexToTronAddress(hex: string): string {
  return TronWeb.address.fromHex(hex.startsWith('0x') ? hex.slice(2) : hex);
}
```
```typescript
// src/tron/txId.ts
import { TronWeb } from 'tronweb';
export function tronTxId(rawDataHex: string): string {
  const clean = rawDataHex.startsWith('0x') ? rawDataHex : '0x' + rawDataHex;
  const h = TronWeb.utils.ethersUtils.sha256(clean); // 0x + 64 hex
  return h.startsWith('0x') ? h.slice(2) : h;
}
```
Keep `address.test.ts` + `txId.test.ts` (must still reproduce `TRON_GOLDEN.addressHex` / `txId`). Verify the tronweb checksum-reject still throws for a corrupted address.

- [ ] **Step 2: Run — verify PASS** (address 4 + txId 2 still green against golden; full suite; tsc clean).

- [ ] **Step 3: Commit**

```bash
git add src/tron/address.ts src/tron/txId.ts
git commit -m "refactor(tron): address + txID via tronweb utils"
```

---

## Task 6: TRON build via tronweb (local construction — closes §5)

Replace `src/tron/build.ts` (node `create*` calls) with tronweb `transactionBuilder` which builds `raw_data` client-side from our params. This is the §5 closure: the signed bytes encode OUR params, not a trusted node response.

**Files:** rewrite `src/tron/build.ts`; Test rewrite `src/tron/build.test.ts` (mock the tronweb instance)

- [ ] **Step 1: Write failing tests** — builders return a tx whose `raw_data_hex`'s sha256 equals its `txID`, built from our params via a (mocked) tronweb `transactionBuilder`.

```typescript
// src/tron/build.test.ts
import { makeTronWeb, buildTrxTransfer, buildTrc20Transfer } from './build';

const FROM = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';
const TO = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC';

function fakeTw(stub: any) {
  return { transactionBuilder: stub } as any;
}

describe('buildTrxTransfer (tronweb)', () => {
  it('delegates to transactionBuilder.sendTrx(to, amount, from)', async () => {
    const sendTrx = jest.fn(async () => ({ txID: 'abc', raw_data: {}, raw_data_hex: '0a02', visible: false }));
    const tx = await buildTrxTransfer(fakeTw({ sendTrx }), FROM, TO, 1000000n);
    expect(sendTrx).toHaveBeenCalledWith(TO, 1000000, FROM);
    expect(tx.txID).toBe('abc');
  });
});

describe('buildTrc20Transfer (tronweb)', () => {
  it('delegates to triggerSmartContract transfer(address,uint256)', async () => {
    const triggerSmartContract = jest.fn(async () => ({ transaction: { txID: 'beef', raw_data: {}, raw_data_hex: '0a', visible: false } }));
    const usdt = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    const tx = await buildTrc20Transfer(fakeTw({ triggerSmartContract }), FROM, usdt, TO, 5000000n);
    expect(triggerSmartContract).toHaveBeenCalledWith(
      usdt, 'transfer(address,uint256)', expect.any(Object),
      [{ type: 'address', value: TO }, { type: 'uint256', value: '5000000' }], FROM,
    );
    expect(tx.txID).toBe('beef');
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement** using tronweb's `transactionBuilder` (instance created from the chain rpc)

```typescript
// src/tron/build.ts
import { TronWeb } from 'tronweb';
import type { Endpoints, TronUnsignedTx } from './types';

export function makeTronWeb(rpc: Endpoints): any {
  return new TronWeb({ fullHost: rpc.primary });
}

export async function buildTrxTransfer(tw: any, from: string, to: string, amountSun: bigint): Promise<TronUnsignedTx> {
  if (amountSun > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('amount exceeds MAX_SAFE_INTEGER');
  return tw.transactionBuilder.sendTrx(to, Number(amountSun), from);
}

export async function buildTrc20Transfer(tw: any, from: string, contract: string, to: string, amount: bigint): Promise<TronUnsignedTx> {
  const { transaction } = await tw.transactionBuilder.triggerSmartContract(
    contract, 'transfer(address,uint256)', { feeLimit: 100_000_000, callValue: 0 },
    [{ type: 'address', value: to }, { type: 'uint256', value: amount.toString() }], from,
  );
  return transaction;
}

export async function buildFreezeV2(tw: any, from: string, frozenSun: bigint, resource: 'ENERGY' | 'BANDWIDTH'): Promise<TronUnsignedTx> {
  if (frozenSun > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('amount exceeds MAX_SAFE_INTEGER');
  return tw.transactionBuilder.freezeBalanceV2(Number(frozenSun), resource, from);
}

export interface VoteEntry { srAddress: string; voteCount: number; }
export async function buildVote(tw: any, from: string, votes: VoteEntry[]): Promise<TronUnsignedTx> {
  const map: Record<string, number> = {};
  for (const v of votes) map[v.srAddress] = v.voteCount;
  return tw.transactionBuilder.vote(map, from);
}
```
NOTE: verify the exact tronweb 6.x `transactionBuilder` method signatures against the installed version (`freezeBalanceV2`, `vote` arg shapes vary). Adjust to the real API; the tests pin the call shape — align both.

- [ ] **Step 4: Run — verify PASS** (build tests green; tsc clean). Delete `src/tron/buildGuard.test.ts`'s now-redundant parts only if superseded (keep the MAX_SAFE_INTEGER guard test — the guard is retained above).

- [ ] **Step 5: Commit**

```bash
git add src/tron/build.ts src/tron/build.test.ts
git commit -m "refactor(tron): build txs via tronweb transactionBuilder (client-side raw_data)"
```

---

## Task 7: Simplify the verify gate (§5 closed by local construction) + rewire TronSigningAdapter

Because tronweb builds `raw_data` from OUR params client-side, the verify gate no longer needs to decode/trust a node response. It retains the integrity check (`txID == sha256(raw_data_hex)`) as defense in depth and confirms the builder used our params.

**Files:** rewrite `src/tron/verify.ts`; rewire `src/chain-adapter/TronSigningAdapter.ts` to construct a tronweb instance and pass it to builders; update tests

- [ ] **Step 1: Rewrite `verify.ts`** — integrity check + (optional) tronweb decode cross-check
```typescript
import { tronTxId } from './txId';
import type { TronUnsignedTx } from './types';

// raw_data is built client-side by tronweb from our params, so intent is correct by construction.
// This retains the integrity invariant: the txID we sign is sha256 of the exact bytes built.
export function verifyTronTx(tx: TronUnsignedTx): void {
  const local = tronTxId(tx.raw_data_hex);
  if (local !== tx.txID) throw new Error(`txID mismatch: ${tx.txID} != local ${local}`);
}
```
- [ ] **Step 2: Rewire `TronSigningAdapter`** — create `makeTronWeb(this.config.rpc)` once; builders take `tw`; `signAndBroadcast` calls `verifyTronTx(tx)` then `signTronTx` (signs local txID) then `broadcastTronTx`. The `sendTrx/sendTrc20/freeze/vote` pass `tw` + params. Multisig unchanged.
- [ ] **Step 3: Update `TronSigningAdapter.test.ts`** — mock the tronweb instance's `transactionBuilder` to return a golden tx (txID==sha256(rawDataHex)); assert the SECURITY property still holds: a tampered `txID` (≠ sha256) aborts before `signHash`. (Contract-type/intent JSON checks are dropped — params now originate from our call, not the node.)
- [ ] **Step 4: Run — verify PASS** (full suite; tsc clean).
- [ ] **Step 5: Commit**

```bash
git add src/tron/verify.ts src/tron/verify.test.ts src/chain-adapter/TronSigningAdapter.ts src/chain-adapter/TronSigningAdapter.test.ts src/tron/sign.ts src/tron/sign.test.ts
git commit -m "refactor(tron): verify integrity only (raw_data built client-side via tronweb) — closes §5"
```

---

## Task 8: Delete superseded hand-rolled modules

**Files:** remove now-unused hand-rolled code, confirm nothing imports it.

- [ ] **Step 1:** `grep -rn` for imports of each candidate before deleting. Remove `src/tron/protobuf.ts`/`decodeRawData.ts` if they were created by the dropped §5 plan (they should not exist on this branch — confirm). Remove any hand-rolled helper now fully covered by viem/tronweb that has ZERO remaining importers (e.g. parts of `src/crypto/bytes.ts` if unused — but keep what tests/TRON still use). Do NOT delete a module that still has importers.
- [ ] **Step 2:** Full suite green + tsc clean after deletions.
- [ ] **Step 3: Commit** `git commit -am "chore: remove hand-rolled crypto superseded by viem/tronweb"`

---

## Task 9: On-device re-validation (all capstones) both platforms

The retrofit must not regress device behavior. Re-run every self-test on both platforms.

- [ ] **Step 1:** Ensure the polyfills (Task 1) are in `index.js`. Build + run Android, then iOS (`--client-logs`).
- [ ] **Step 2:** Capture and confirm ALL of these still report `ALL_PASS` on BOTH platforms:
  - `SELFTEST_RESULT=ALL_PASS` (Phase-0 bridge golden)
  - `READONLY_RESULT=ALL_PASS` (Phase-1 balances)
  - `EVMSIGN_RESULT=ALL_PASS` (Phase-2 EVM signed-tx == golden, now via viem)
  - `TRONSIGN_RESULT=ALL_PASS` (Phase-3 TRON create→verify→sign, now via tronweb)
- [ ] **Step 3:** If a capstone references a deleted/renamed function, update the devtools self-test imports accordingly (behavior unchanged). Commit any fixes: `git commit -am "test: update device capstones for viem/tronweb retrofit"`

---

## Task 10: Docs — close §5, record library adoption

**Files:** update `docs/phase2-evm.md`, `docs/phase3-tron.md`; create `docs/library-adoption.md`

- [ ] **Step 1:** `docs/phase3-tron.md` §5 → **CLOSED**: raw_data is now built client-side by tronweb from our params; the signed bytes encode our intent by construction; integrity retained via `txID==sha256(raw_data_hex)`. Residual trust: tronweb's construction correctness (established library) + node ref-block (liveness only).
- [ ] **Step 2:** `docs/phase2-evm.md` → note EVM encoding/signing-hash/ABI/message now use viem (golden vectors unchanged).
- [ ] **Step 3:** Create `docs/library-adoption.md`: rationale (drop hand-rolled crypto risk), viem (EVM) + tronweb (TRON) + the polyfill recipe, the native-signing injection model (`serializeTransaction(tx, sig)` / `tx.signature=[hex]`), removed modules + the dropped `ethers` dep, and the spike evidence (both libs reproduce golden vectors in Hermes on both platforms).
- [ ] **Step 4: Commit** `git commit -am "docs: record viem/tronweb adoption; mark Phase-3 §5 closed"`

---

## Self-Review

**Spec coverage:** EVM→viem (Tasks 2/3/4), TRON→tronweb (Tasks 5/6/7), §5 closed via client-side construction (Task 7), `ethers` dep removed (Task 1), hand-rolled modules deleted (Tasks 2/8), polyfills landed (Task 1), device re-validation (Task 9), docs (Task 10). ✅

**Behavior preservation (the safety net):** every retrofitted module keeps its existing golden test (`EVM_GOLDEN`, `TRON_GOLDEN`) — viem/tronweb must reproduce the exact pinned values, proven in Jest AND on both devices (Task 9). The spike already showed viem reproduces `signingHash`/`signedRawTx`/`hashMessage` and tronweb reproduces `addressHex`/`txId`. ✅

**No placeholders:** real code per step; library API-shape notes (viem `TransactionSerializableEIP1559`, tronweb `transactionBuilder.*` arg shapes) are flagged to verify against the installed version, backed by run-red/run-green + golden assertions. ✅

**Key-safety invariant unchanged:** signing still only crosses the bridge as `signHash(walletRef, coinType, hash)`; viem/tronweb never receive a private key — they build/encode, and the native signature is injected back. ✅

**Type consistency:** `UnsignedEvmTx` shape preserved (Task 2) so `EvmSigningAdapter` (Task 4) is unchanged. `tronTxId`/`tronAddressToHex`/`hexToTronAddress` keep their signatures (Task 5) so `verify`/adapter consumers compile. `TronUnsignedTx`/`TronSignedTx` unchanged; builders now take a `tw` instance (Task 6) consumed by `TronSigningAdapter` (Task 7). `erc20BalanceOfData`/`decodeUint256`/`personalSignHash`/`toEthSignatureV`/`eip1559SigningHash`/`assembleSignedEip1559`/`evmTxHash` keep their signatures so all consumers + golden tests are source-compatible.
