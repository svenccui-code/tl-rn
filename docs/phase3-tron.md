# Phase 3 — TRON Write Path Exit Gate

> Status: **PASSED** (with one CRITICAL production-gate item open — see §5).
> Date: 2026-06-08 · Branch: `phase3-tron-write-path`
> Plan: [`docs/superpowers/plans/2026-06-08-tronlink-rn-phase3-tron-write-path.md`](superpowers/plans/2026-06-08-tronlink-rn-phase3-tron-write-path.md)
> Builds on: [`docs/phase0-foundation.md`](phase0-foundation.md), [`docs/phase1-readonly.md`](phase1-readonly.md), [`docs/phase2-evm.md`](phase2-evm.md)

Phase 3 implements the **TRON write path**: TRX transfer, TRC-20 (USDT) transfer, Stake 2.0 freeze, and voting — built via TronGrid, locally verified, signed through the Phase-0 `signHash` bridge (single + multisig), and broadcast. **No native/codegen changes.**

## 1. Mechanism (architecture §5 universal path)

```
build (TronGrid create*) → tx{ txID, raw_data, raw_data_hex }
  → VERIFY: localTxId = sha256(raw_data_hex); require localTxId === tx.txID
            require exactly 1 contract of the expected contractType
            fail-closed intent check (owner / to / amount) against decoded params
  → SIGN:   signHash(walletRef, 195, '0x' + localTxId)   ← signs the LOCAL txID, never the node's
            attach bare-hex signature to signature[]  (N entries for multisig)
  → BROADCAST: POST /wallet/broadcasttransaction → txid
```
Only the 32-byte txID crosses the bridge; the private key never leaves native.

## 2. Golden vectors (`src/tron/tronGolden.ts`)

| Vector | Value / source |
| --- | --- |
| txID algorithm | real mainnet pair: `tronTxId(rawDataHex) === txId` (`b6ee5bf4…`), verified with python sha256 before pinning |
| address base58↔hex | golden `TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH` → `41c8599111f29c1e1e061265b4af93ea1f274ad78a` (independently confirmed by pure-python base58 decode) |
| signature primitive | reuses the Phase-0 pinned TRON `signHash` (coinType 195) — already golden-tested |

## 3. Supported operations

- TRX transfer (`/wallet/createtransaction`, `TransferContract`)
- TRC-20 transfer (`/wallet/triggersmartcontract`, `TriggerSmartContract`; `transfer(address,uint256)` param hand-encoded via base58→hex)
- Stake 2.0 freeze (`/wallet/freezebalancev2`, `FreezeBalanceV2Contract`)
- Vote (`/wallet/votewitnessaccount`, `VoteWitnessContract`)
- Multisig signing: N permission keys sign the same local txID → `signature[]` array
Adding more types (unfreeze/withdraw/delegate, etc.) = one more builder + a `signAndBroadcast` call with the right `contractType` — the verify/sign/broadcast machinery is shared.

## 4. Security gate (hardened after commit review)

`verifyTronTx(tx, intent)` runs before EVERY sign (enforced in `TronSigningAdapter.signAndBroadcast` / `sendMultisig`):
1. **Recompute txID locally** from `raw_data_hex`; reject if it differs from the node's `tx.txID`.
2. **Require exactly one contract** of the expected `contractType` (reject wrong type / multi-contract).
3. **Fail-closed intent**: every set intent field (`owner` required; `to`/`amount` if provided) must be present in the tx AND equal — absence is a denial, not a skip.
4. **Sign the locally-recomputed txID**, never the node-provided `tx.txID` (defense in depth at the signing sink — proven by a unit test that signs the local txID even when `tx.txID` is tampered).

Tests prove that a mismatched node txID or wrong contract type aborts BEFORE `signHash` is called.

## 5. ⚠️ Known CRITICAL limitation (production gate — open)

`verifyTronTx` compares intent against the node's **decoded `raw_data` JSON**, not against a local protobuf decode of `raw_data_hex`. A fully malicious node could desynchronize `raw_data` (JSON) from `raw_data_hex` (the bytes that are actually signed): we recompute `txID = sha256(raw_data_hex)` (so we sign exactly those bytes) but we trust the node's JSON to describe them. **This was flagged CRITICAL by automated commit review and must be closed before production.**

Closure options (architecture D6):
- **(a)** Locally protobuf-decode `raw_data_hex` and run intent checks against the decoded structure; OR
- **(b)** Reconstruct `raw_data_hex` from caller-supplied params and compare byte-for-byte; OR
- **(c)** Use a trusted self-operated TRON node (so the JSON↔hex correspondence is trusted).

The cheap hardenings (contract-type, fail-closed, sign-local-txID) are done; this trustless-decode item remains. Mitigation today: the bytes signed are integrity-checked (`txID==sha256(raw_data_hex)`) and the chosen RPC is TronGrid.

## 6. Exit criteria & evidence

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | Full Jest suite passes | **25 suites / 85 tests** (txId, address, build, verify, sign, broadcast, TronSigningAdapter + all prior). |
| 2 | TypeScript clean | `yarn tsc --noEmit` clean. |
| 3 | On-device mechanism, both platforms | `TRONSIGN_RESULT=ALL_PASS` on iOS (iPhone 17 Pro) + Android (Pixel 10): real TronGrid (Nile testnet, see note) create → local `txID==sha256(raw_data_hex)` → owner==golden → live `signHash` 65-byte signature. No broadcast (zero funds). |
| 4 | Security gate proven | Adapter tests confirm a mismatched node txID OR wrong contract type aborts BEFORE `signHash` is called; sign signs the local txID even when `tx.txID` is tampered. |

> Capstone note: mainnet `createtransaction` rejects the unfunded golden address ("balance is not sufficient"), so the on-device self-test uses the **Nile testnet** (`https://nile.trongrid.io`) — the build→sha256→sign pipeline is chain-agnostic; this Nile URL is confined to `src/devtools/TronSignSelfTest.ts` only. The production registry (`chains.ts`) still points TRON at mainnet `https://api.trongrid.io`.

## 7. Commit log (Phase 3)

```
cdf6830 test: on-device TRON write mechanism (create->verify->live sign, no broadcast)
7965e43 feat: add TronSigningAdapter (verify-gate build/sign/broadcast + multisig)
a394c9d fix(security): harden TRON verify gate (contract-type, fail-closed) and sign local txID
7b7be30 feat: add TRON broadcast + Stake 2.0 freeze + vote builders
8bd7f95 feat: add TRON txID/intent verify gate + single/multisig signing
81ec297 feat: add TronGrid TRX + TRC-20 transaction builders
ebc8c93 feat: add TRON base58check address <-> hex conversion
a58fad4 feat: add TRON txID (sha256 of raw_data) with mainnet golden vector
```

## 8. Deferred

- **Close the §5 CRITICAL** (local raw_data protobuf decode or reconstruction, or trusted node) before production.
- **GasFree** — a relayer/meta-transaction protocol (GasFree service API + permit), not a plain tx type; its own phase.
- Unfreeze / withdraw-expire / delegate-resource variants (thin builder additions, same mechanism).
- `window.tron` DApp provider (TIP-1193) + dual provider with `window.ethereum` → **Phase 4**.
- Carried debt: public RPC → self gateway (also helps close §5 via a trusted node); Gradle dependency verification; PAT rotation; metro `useWatchman` CI-scoping.

## 9. Handoff → Phase 4 (DApp dual provider)

EVM (Phase 2) and TRON (Phase 3) write paths both work. Phase 4 adds the TRON DApp provider (`window.tron`, TIP-1193) alongside the existing `window.ethereum`, EIP-6963 multi-provider announcement, `eth_signTypedData_v4`, and the full connect/approval UX (the `confirm` hook → real modal). A state layer (Store/Service/EventBus) will likely be introduced for the UI at this stage.
