# Library Adoption — viem (EVM) + tronweb (TRON)

> Date: 2026-06-09 · Branch: `retrofit/viem-tronweb`
> Plan: [`docs/superpowers/plans/2026-06-08-tronlink-rn-library-adoption-retrofit.md`](superpowers/plans/2026-06-08-tronlink-rn-library-adoption-retrofit.md)

The project's hand-rolled crypto/encoding (RLP, keccak, ABI, EIP-191, base58check, TRON txID/protobuf, raw param encoding) has been replaced with established libraries: **viem** for EVM and **tronweb** for TRON. This removes a hand-rolled-crypto risk surface (repeatedly flagged by commit security reviews) and closes the Phase-3 §5 CRITICAL by construction.

## Principle

Don't hand-roll encoding/crypto. Use **viem** (EVM) and **tronweb** (TRON). Keys stay native: the libraries only **build / hash / encode / serialize** — the signature comes from `SecureKeyring.signHash` (native TWCore) and is injected back into the library's serializer. Libraries never receive a private key.

## What changed

| Concern | Before (hand-rolled) | After |
| --- | --- | --- |
| EVM EIP-1559 encode + signing hash | `src/evm/rlp.ts` + `src/evm/tx.ts` | viem `serializeTransaction` + `keccak256` |
| EVM signed-tx assembly | hand RLP + yParity | viem `serializeTransaction(tx, { r, s, yParity })` |
| ERC-20 ABI | `src/chain-adapter/abi.ts` (hand selector+pad) | viem `encodeFunctionData` / `decodeAbiParameters` |
| EIP-191 personal_sign | `src/evm/message.ts` (hand prefix+keccak) | viem `hashMessage` |
| keccak-256 | `src/crypto/keccak.ts` (@noble/sha3) | viem `keccak256` |
| TRON address base58check | `src/tron/address.ts` (hand base58) | tronweb `TronWeb.address.toHex/fromHex` |
| TRON txID | `src/tron/txId.ts` (@noble sha256) | tronweb `utils.ethersUtils.sha256` |
| TRON tx build (raw_data) | TronGrid `create*` over fetch + hand param encode | tronweb `transactionBuilder.*` (client-side raw_data) |

**Deleted modules:** `src/evm/rlp.ts`, `src/crypto/bytes.ts`, `src/crypto/keccak.ts` (+ their tests) — fully superseded, zero importers. **Removed dependency:** `ethers` (was mistakenly a runtime dep; only ever an offline golden oracle via `npx`).

## Native-signing injection model (unchanged invariant)

- **EVM:** `keccak256(serializeTransaction(unsigned))` → signing hash → `SecureKeyring.signHash(ref, 60, hash)` → 65-byte `r||s||yParity` → `serializeTransaction(unsigned, { r, s, yParity })` → signed rawTx.
- **TRON:** `tronweb.transactionBuilder.sendTrx/...(params)` → `{ txID, raw_data_hex }` (built client-side) → integrity check `txID === sha256(raw_data_hex)` → `SecureKeyring.signHash(ref, 195, '0x'+txID)` → bare-hex signature → `tx.signature = [hex]` → broadcast.

Only a 32-byte hash crosses the bridge in both cases. The private key never leaves native (verified by the on-device `no-private-key-leak` guard + the signed-tx golden parity).

## §5 (Phase-3 CRITICAL) — CLOSED

Previously, TRON intent was verified against a node's `raw_data` JSON (trusting the node's decode of the bytes it returned). Now **tronweb builds `raw_data` client-side from our explicit params**, so the signed bytes encode our intent by construction. `verifyTronTx` reduces to the integrity invariant (`txID === sha256(raw_data_hex)`) as defense in depth. No node-JSON trust, no hand-rolled protobuf decoder. Residual trust: tronweb's construction correctness (established library) + the node's ref-block/timestamp (liveness only, not fund-safety).

## RN / Hermes integration (validated by spike)

Spike branch `spike/libs-rn-validation` proved both libs run in Hermes on iOS + Android and reproduce the golden vectors. Polyfills required (in `index.js` + `metro.config.js`):
- `import 'react-native-get-random-values';` (first import) — `crypto.getRandomValues`.
- `global.Buffer = require('buffer').Buffer` — tronweb uses `Buffer`.
- metro `resolver.extraNodeModules`: `{ buffer, stream: stream-browserify }`.
viem needs no polyfills.

## Validation (the safety net)

Every retrofitted module kept its existing golden test — viem/tronweb must reproduce the exact pinned values:
- viem reproduces `EVM_GOLDEN` (signing hash, signed rawTx, txHash) + the canonical keccak/personal_sign hashes.
- tronweb reproduces `TRON_GOLDEN` (addressHex, txId).
- Jest: 23 suites / 75 tests green; `tsc --noEmit` clean.
- **On-device, both platforms:** `SELFTEST_RESULT`, `READONLY_RESULT`, `EVMSIGN_RESULT`, `TRONSIGN_RESULT` all `ALL_PASS` after the retrofit — the EVM signed-tx (viem) and TRON build+sign (tronweb) reproduce golden behavior end-to-end on real devices.

## Going forward

New encoding/crypto work uses viem (EVM) / tronweb (TRON) — do not hand-roll. The chain-registry / chain-adapter / native-bridge layering is unchanged; the libraries sit inside the adapters.
