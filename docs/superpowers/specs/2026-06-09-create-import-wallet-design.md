# Create / Import Wallet Onboarding — Design Spec

> Date: 2026-06-09 · Project: `tronlink-rn`
> Goal: replace the `EmptyWallet` placeholder with a real, simplified wallet-onboarding flow — an entry screen offering **Create** and **Import**, both fully functional — referencing the Android `EmptyWalletActivity` for look/structure but with deliberately simplified logic.

## Source of truth (reference, not a 1:1 copy)

The TronLink Android `EmptyWalletActivity` (`com/tron/wallet/business/welcome/`, layout `ac_emptytronwallet.xml`): white background, an onboarding guide carousel (ViewPager2), a bold title (`guide7` = "Well-Rounded TRON Features") + gray subtitle (`guide2` = "Full support for TRX and all types of Mainnet tokens and functions"), two side-by-side buttons — **Create Wallet** (light `#F4F4F7`, 10dp radius) and **Import Wallet** (dark `#1A212B`, white text, 10dp radius) with icons (`ic_add_method_create` / `ic_add_method_import`), plus a "Switch to Cold Wallet Mode" link and an "Other Options" expander.

**Simplified (NOT copied):** the carousel guide images, the cold-wallet switch, "Other Options", password/passcode, private-key/keystore import variants, and the mnemonic re-entry verification quiz are all dropped. We keep: white screen + TronLink logo + title + subtitle + the two action buttons (with the reused icons).

## Scope (decided)

**In scope — entry + BOTH flows real:**
1. `EmptyWalletScreen` (replace placeholder): the simplified onboarding entry.
2. `CreateWalletScreen`: generate a new wallet → display the mnemonic for backup → acknowledge → land in the wallet.
3. `ImportWalletScreen`: paste a mnemonic → import → land in the wallet.
4. `WalletHomeScreen`: minimal post-onboarding landing that lists the derived accounts (reads `WalletStore`).
5. Native bridge: add `createWallet()` to `SecureKeyring` (generate a fresh mnemonic via Trust Wallet Core).

**Out of scope (deferred):** carousel/cold-wallet/other-options, password/passcode, private-key & keystore import, mnemonic-verify quiz, a full home screen (balances/tx/settings — `WalletHome` here is a minimal account list), making create/backup a native-only screen.

## Architecture

```
Welcome → EmptyWallet ─┬─ Create Wallet → CreateWallet ─┐
                       └─ Import Wallet → ImportWallet ──┴→ WalletHome
```

| Unit | File | Responsibility |
| --- | --- | --- |
| Entry | `src/screens/wallet/EmptyWalletScreen.tsx` (replace) | logo + title + subtitle + Create/Import buttons → navigate |
| Create flow | `src/screens/wallet/CreateWalletScreen.tsx` | `KeyringService.createWallet()` → show mnemonic grid + "I've backed it up" → finalize → `WalletHome` |
| Import flow | `src/screens/wallet/ImportWalletScreen.tsx` | mnemonic `TextInput` + validate + `KeyringService.importMnemonic()` → finalize → `WalletHome` |
| Home (minimal) | `src/screens/wallet/WalletHomeScreen.tsx` | reads `useWalletStore().accounts`, lists chain name + address |
| Onboarding helper | `src/state/services/KeyringService.ts` (extend) | add `createWallet()`; add a `finalizeWallet(walletRef)` helper that builds the account tree and writes `WalletStore` |
| Native bridge | `src/native-bridge/NativeSecureKeyring.ts` (+ iOS/Android impl) | add `createWallet(): Promise<{ walletRef: string; mnemonic: string }>` |
| Reused icons | `assets/ic_add_method_create.png`, `assets/ic_add_method_import.png` | copied from Android `mipmap-xxhdpi` |

Navigation: add routes `CreateWallet`, `ImportWallet`, `WalletHome` to `RootStackParamList` + the stack in `App.tsx` (headerShown stays false; Create/Import may show a back via a simple top bar — minimal).

## Native bridge: `createWallet`

- **TS spec** (`NativeSecureKeyring.ts`): `createWallet(): Promise<{ walletRef: string; mnemonic: string }>`.
- **iOS** (`SecureKeyringCore.swift` + `.mm`): `HDWallet(strength: 128, passphrase: "")` → new 12-word wallet; store the handle in the in-memory map keyed by a UUID; return `{ walletRef, mnemonic: wallet.mnemonic }`.
- **Android** (`SecureKeyringModule.kt`): `HDWallet(128, "")` → `{ walletRef, mnemonic: wallet.mnemonic() }`.
- Codegen regenerates the spec; both native impls conform.
- **Non-deterministic** (random mnemonic) → no golden vector. Validated by: the returned mnemonic is 12 words; `deriveAddress(walletRef, 60/195)` on it returns valid EVM/TRON addresses (so the wallet is real and usable).

## State layer wiring

- `KeyringService.createWallet(): Promise<{ walletRef, mnemonic }>` — wraps the bridge, emits `wallet/added`.
- `KeyringService.importMnemonic(mnemonic)` — already exists (emits `wallet/added`).
- New `KeyringService.finalizeWallet(walletRef): Promise<void>` — `buildAccountTree(walletRef)` → `useWalletStore.getState().setWallet(walletRef, accounts)`. Called by both flows after the user proceeds.
- `WalletHomeScreen` reads `useWalletStore(s => s.accounts)` (selector) — UI reads state only via the store (state-layer rule 1).

## Data flow

**Create:** EmptyWallet → "Create Wallet" → CreateWalletScreen mounts → `createWallet()` → render the 12 words in a numbered grid + a "I have written down my recovery phrase" checkbox → on confirm: `finalizeWallet(walletRef)` → `navigation.replace('WalletHome')`.

**Import:** EmptyWallet → "Import Wallet" → ImportWalletScreen → user pastes the phrase → "Import": trim/normalize, call `importMnemonic(phrase)` (the bridge throws on an invalid phrase → show an inline error); on success `finalizeWallet(walletRef)` → `navigation.replace('WalletHome')`.

**Home:** lists `accounts` (caip2 name + address). If `walletRef` is undefined (e.g., reached directly), show an empty state.

## Security note (honest)

`createWallet`/import returns/accepts the mnemonic through JS for backup display / input. This is the architecture's accepted tradeoff (same as Trust Wallet): the mnemonic transits JS only during create/backup/import; the **signing path never exposes the private key** (signing stays native via `signHash`). Hardening (a native-only create/backup screen so the mnemonic never enters JS) is a documented follow-up. No passcode/encryption-at-rest yet (deferred) — acceptable for this dev stage; flagged for production.

## Testing

- **Jest (screens):** `EmptyWalletScreen` renders + the two buttons call `navigation.navigate('CreateWallet'|'ImportWallet')`. `CreateWalletScreen` — mock `KeyringService.createWallet` to return a fixed `{walletRef, mnemonic}`; assert the 12 words render and confirm calls `finalizeWallet` + `replace('WalletHome')`. `ImportWalletScreen` — mock `importMnemonic`; valid → finalize + replace; invalid (mock throws) → inline error shown, no navigation. `WalletHomeScreen` — set `WalletStore` accounts, assert they render.
- **Jest (service):** `KeyringService.createWallet` calls the bridge + emits `wallet/added`; `finalizeWallet` builds the tree (mocked) + writes WalletStore.
- **Native (createWallet):** XCTest + Android instrumented — `createWallet` returns a 12-word mnemonic and a walletRef whose `deriveAddress(.ethereum)` / `.tron` are valid addresses (EVM `0x…40hex`, TRON `T…`).
- **On-device capstone (both platforms):** import the golden mnemonic via the real Import screen → `WalletHome` shows the golden EVM (`0x9858…`) + TRON (`TUEZ…`) addresses; create a new wallet → 12 words shown → confirm → `WalletHome` shows freshly-derived addresses (non-golden, just well-formed). Existing Welcome→EmptyWallet flow + DevSelfTest unaffected.

## Risks

- Native `createWallet` is the heaviest part (Swift/ObjC++ + Kotlin + codegen + two native builds). `HDWallet.mnemonic` / `HDWallet(strength:passphrase:)` are confirmed TWCore APIs (used in Phase 0).
- Mnemonic display in JS is the security tradeoff noted above.
- `WalletHome` is intentionally minimal (account list) — not a full home; future work.
