# Create / Import Wallet Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `EmptyWallet` placeholder with a simplified-but-functional wallet onboarding flow: an entry screen offering Create and Import, a Create flow (new mnemonic via Trust Wallet Core → backup → land in wallet), an Import flow (paste mnemonic → land in wallet), and a minimal `WalletHome` listing the derived accounts.

**Architecture:** Add `createWallet()` to the native `SecureKeyring` bridge (TWCore generates a fresh mnemonic). `KeyringService` gains `createWallet()` + `finalizeWallet(walletRef)` (build account tree → write `WalletStore`). Screens (by business domain under `src/screens/wallet/`) read state via store selectors and invoke services via the DI `container` singleton — following the state-layer rules. Navigation: native-stack routes `CreateWallet` / `ImportWallet` / `WalletHome`.

**Tech Stack:** React Native 0.84 · React Navigation native-stack · Trust Wallet Core (native `HDWallet`) · zustand/mitt state layer · Jest.

**Spec:** [`docs/superpowers/specs/2026-06-09-create-import-wallet-design.md`](../specs/2026-06-09-create-import-wallet-design.md)

---

## File Structure

| File | Responsibility |
| --- | --- |
| `assets/ic_add_method_create.png`, `assets/ic_add_method_import.png` | button icons copied from Android `mipmap-xxhdpi` |
| `src/navigation/types.ts` (modify) | add `CreateWallet` / `ImportWallet` / `WalletHome` routes |
| `src/native-bridge/NativeSecureKeyring.ts` (modify) | add `createWallet(): Promise<CreatedWallet>` |
| `src/native-bridge/__mocks__/NativeSecureKeyring.ts` (modify) | mock `createWallet` |
| `ios/TronLinkRN/SecureKeyringCore.swift` + `SecureKeyring.mm` (modify) | native `createWallet` |
| `android/.../securekeyring/SecureKeyringModule.kt` (modify) | native `createWallet` |
| `src/state/services/KeyringService.ts` (modify) | `createWallet()` + `finalizeWallet()` |
| `src/state/container.ts` (modify) | export a `container` singleton |
| `src/screens/wallet/EmptyWalletScreen.tsx` (replace) | onboarding entry |
| `src/screens/wallet/CreateWalletScreen.tsx` | create flow |
| `src/screens/wallet/ImportWalletScreen.tsx` | import flow |
| `src/screens/wallet/WalletHomeScreen.tsx` | minimal account list |
| `App.tsx` (modify) | register the new routes |
| `src/devtools/OnboardingSelfTest.ts` + `DevSelfTestScreen` (modify) | on-device create+import validation |

---

## Task 1: Button icons + route types

**Files:**
- Create: `assets/ic_add_method_create.png`, `assets/ic_add_method_import.png`
- Modify: `src/navigation/types.ts`

- [ ] **Step 1: Copy the icons**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
cp ../tronlink-android/app/src/main/res/mipmap-xxhdpi/ic_add_method_create.png assets/ic_add_method_create.png
cp ../tronlink-android/app/src/main/res/mipmap-xxhdpi/ic_add_method_import.png assets/ic_add_method_import.png
ls -la assets/ic_add_method_*.png
```
Expected: both files copied.

- [ ] **Step 2: Extend the route-param type**

Replace `src/navigation/types.ts`:
```typescript
export type RootStackParamList = {
  Welcome: undefined;
  EmptyWallet: undefined;
  CreateWallet: undefined;
  ImportWallet: undefined;
  WalletHome: undefined;
  DevSelfTest: undefined;
};
```

- [ ] **Step 3: Typecheck**

Run: `yarn tsc --noEmit`
Expected: clean (App.tsx/screens not yet referencing the new routes at runtime — type-only addition).

- [ ] **Step 4: Commit**

```bash
git add assets/ic_add_method_create.png assets/ic_add_method_import.png src/navigation/types.ts
git commit -m "build: add create/import icons + onboarding route types"
```

---

## Task 2: Native bridge `createWallet`

**Files:**
- Modify: `src/native-bridge/NativeSecureKeyring.ts`, `src/native-bridge/__mocks__/NativeSecureKeyring.ts`, `ios/TronLinkRN/SecureKeyringCore.swift`, `ios/TronLinkRN/SecureKeyring.mm`, `android/app/src/main/java/com/tronlinkrn/securekeyring/SecureKeyringModule.kt`

- [ ] **Step 1: Add to the TS spec**

In `src/native-bridge/NativeSecureKeyring.ts`, add a type + method to the `Spec` interface (above the existing methods):
```typescript
export type CreatedWallet = { walletRef: string; mnemonic: string };
```
and inside `interface Spec extends TurboModule { ... }`:
```typescript
  // Generate a brand-new HD wallet (fresh mnemonic) in native; mnemonic returned ONCE for backup.
  createWallet(): Promise<CreatedWallet>;
```

- [ ] **Step 2: Add to the Jest mock**

In `src/native-bridge/__mocks__/NativeSecureKeyring.ts`, add to the default export object:
```typescript
  createWallet: jest.fn(async () => ({
    walletRef: 'mock-created-ref',
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  })),
```

- [ ] **Step 3: iOS — Swift core**

In `ios/TronLinkRN/SecureKeyringCore.swift`, add a method to the class:
```swift
    @objc public func createWallet() -> [String: String]? {
        guard let w = HDWallet(strength: 128, passphrase: "") else { return nil }
        let ref = UUID().uuidString
        lock.lock(); wallets[ref] = w; lock.unlock()
        return ["walletRef": ref, "mnemonic": w.mnemonic]
    }
```

- [ ] **Step 4: iOS — ObjC++ TurboModule**

In `ios/TronLinkRN/SecureKeyring.mm`, add the method (the codegen protocol method for a no-arg Promise is `createWallet:reject:`):
```objc
- (void)createWallet:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject {
  NSDictionary *r = [_core createWallet];
  r ? resolve(r) : reject(@"create_failed", @"could not create wallet", nil);
}
```
After editing, regenerate codegen + confirm the generated protocol's exact selector: `cd ios && pod install`, then `grep -A2 createWallet build/generated/ios/ReactCodegen/SecureKeyringSpec/SecureKeyringSpec.h`. Align the `.mm` selector to the generated one if it differs.

- [ ] **Step 5: Android — Kotlin**

In `android/app/src/main/java/com/tronlinkrn/securekeyring/SecureKeyringModule.kt`, add an override (the codegen abstract class will declare `createWallet(promise: Promise)`):
```kotlin
  override fun createWallet(promise: com.facebook.react.bridge.Promise) {
    try {
      val w = wallet.core.jni.HDWallet(128, "")
      val ref = java.util.UUID.randomUUID().toString()
      wallets[ref] = w
      val map = com.facebook.react.bridge.Arguments.createMap()
      map.putString("walletRef", ref)
      map.putString("mnemonic", w.mnemonic())
      promise.resolve(map)
    } catch (e: Throwable) {
      promise.reject("create_failed", e)
    }
  }
```
(`wallets` is the existing `ConcurrentHashMap<String, HDWallet>`; `HDWallet(128, "")` generates a 128-bit = 12-word mnemonic.)

- [ ] **Step 6: Build verification (both platforms compile)**

- iOS: `cd ios && pod install && cd .. && xcodebuild -workspace ios/TronLinkRN.xcworkspace -scheme TronLinkRN -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5` → `** BUILD SUCCEEDED **`.
- Android: `cd android && ./gradlew :app:assembleDebug > /tmp/cw.log 2>&1; echo EXIT=$?` → EXIT=0.
- Jest + tsc: `yarn jest --watchman=false 2>&1 | tail -4` (green; the new mock method doesn't break anything) + `yarn tsc --noEmit` clean.
If codegen rejects the inline `CreatedWallet` object return type, the fallback is `createWallet(): Promise<string>` returning a JSON string and `JSON.parse` in `KeyringService`; adjust spec + both natives + mock accordingly and note it. (The object form is expected to work in RN 0.84 codegen.)

- [ ] **Step 7: Commit**

```bash
git add src/native-bridge/NativeSecureKeyring.ts src/native-bridge/__mocks__/NativeSecureKeyring.ts ios/TronLinkRN/SecureKeyringCore.swift ios/TronLinkRN/SecureKeyring.mm android/app/src/main/java/com/tronlinkrn/securekeyring/SecureKeyringModule.kt ios/Podfile.lock
git commit -m "feat(bridge): add SecureKeyring.createWallet (TWCore-generated mnemonic)"
```

---

## Task 3: KeyringService.createWallet + finalizeWallet + container singleton

**Files:**
- Modify: `src/state/services/KeyringService.ts`, `src/state/container.ts`
- Test: `src/state/services/KeyringService.test.ts` (extend)

- [ ] **Step 1: Write the failing tests** (append to `src/state/services/KeyringService.test.ts`)

```typescript
import { useWalletStore } from '../stores/WalletStore';

describe('KeyringService.createWallet + finalizeWallet', () => {
  beforeEach(() => useWalletStore.setState({ walletRef: undefined, accounts: [], locked: true }));

  it('createWallet wraps the bridge and emits wallet/added', async () => {
    (SecureKeyring.createWallet as jest.Mock).mockResolvedValue({ walletRef: 'r1', mnemonic: 'm m m' });
    const emitted: any[] = [];
    const h = (p: any) => emitted.push(p);
    bus.on('wallet/added', h);
    const res = await new KeyringService().createWallet();
    expect(res).toEqual({ walletRef: 'r1', mnemonic: 'm m m' });
    expect(emitted).toEqual([{ walletRef: 'r1' }]);
    bus.off('wallet/added', h);
  });

  it('finalizeWallet builds the account tree and writes WalletStore', async () => {
    (SecureKeyring.deriveAddress as jest.Mock).mockImplementation(
      async (_ref: string, coinType: number) => (coinType === 60 ? '0xEVM' : 'TADDR'),
    );
    await new KeyringService().finalizeWallet('r1');
    const st = useWalletStore.getState();
    expect(st.walletRef).toBe('r1');
    expect(st.locked).toBe(false);
    expect(st.accounts.length).toBe(3); // TRON + ETH + BSC from the registry
  });
});
```
(`SecureKeyring` + `bus` + `KeyringService` are already imported at the top of the existing test file from earlier tasks.)

- [ ] **Step 2: Run — verify FAIL** (`yarn jest src/state/services/KeyringService.test.ts --watchman=false`).

- [ ] **Step 3: Extend `src/state/services/KeyringService.ts`**

Add imports + methods:
```typescript
import { buildAccountTree } from '../../multichain/accountTree';
import { useWalletStore } from '../stores/WalletStore';
// ... inside the class:
  async createWallet(): Promise<{ walletRef: string; mnemonic: string }> {
    const res = await SecureKeyring.createWallet();
    bus.emit('wallet/added', { walletRef: res.walletRef });
    return res;
  }

  // Build the account tree for a wallet handle and make it the active (unlocked) wallet.
  async finalizeWallet(walletRef: string): Promise<void> {
    const accounts = await buildAccountTree(walletRef);
    useWalletStore.getState().setWallet(walletRef, accounts);
  }
```

- [ ] **Step 4: Add the container singleton**

In `src/state/container.ts`, after `createContainer`, add:
```typescript
// App-wide singleton, constructed once at module load. Screens import this.
export const container = createContainer();
```

- [ ] **Step 5: Run — verify PASS** (`yarn jest src/state/services/KeyringService.test.ts --watchman=false` green; full suite green; `yarn tsc --noEmit` clean).

- [ ] **Step 6: Commit**

```bash
git add src/state/services/KeyringService.ts src/state/services/KeyringService.test.ts src/state/container.ts
git commit -m "feat(state): KeyringService.createWallet/finalizeWallet + container singleton"
```

---

## Task 4: EmptyWalletScreen (onboarding entry)

**Files:**
- Replace: `src/screens/wallet/EmptyWalletScreen.tsx`
- Test: `src/screens/wallet/EmptyWalletScreen.test.tsx` (replace)

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/wallet/EmptyWalletScreen.test.tsx
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { EmptyWalletScreen } from './EmptyWalletScreen';

function renderWith(navigate = jest.fn()) {
  let tree: any;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<EmptyWalletScreen navigation={{ navigate } as any} route={{ key: 'e', name: 'EmptyWallet' } as any} />);
  });
  return { tree, navigate };
}

describe('EmptyWalletScreen', () => {
  it('renders the title + both action buttons', () => {
    const { tree } = renderWith();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Well-Rounded TRON Features');
    expect(json).toContain('Create Wallet');
    expect(json).toContain('Import Wallet');
  });

  it('navigates to CreateWallet / ImportWallet on the buttons', () => {
    const { tree, navigate } = renderWith();
    const pressables = tree.root.findAllByType(require('react-native').Pressable);
    // first Pressable = Create, second = Import (in render order)
    ReactTestRenderer.act(() => pressables[0].props.onPress());
    ReactTestRenderer.act(() => pressables[1].props.onPress());
    expect(navigate).toHaveBeenNthCalledWith(1, 'CreateWallet');
    expect(navigate).toHaveBeenNthCalledWith(2, 'ImportWallet');
  });
});
```

- [ ] **Step 2: Run — verify FAIL** (the old placeholder screen has no "Well-Rounded TRON Features" / no Create-Wallet navigation).

- [ ] **Step 3: Replace `src/screens/wallet/EmptyWalletScreen.tsx`**

```tsx
import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EmptyWallet'>;

// Simplified from Android EmptyWalletActivity: logo + title + subtitle + Create/Import.
export function EmptyWalletScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Image source={require('../../../assets/ic_launcher_pic.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Well-Rounded TRON Features</Text>
        <Text style={styles.subtitle}>Full support for TRX and all types of Mainnet tokens and functions</Text>
      </View>
      <View style={styles.buttons}>
        <Pressable style={[styles.btn, styles.btnLight]} onPress={() => navigation.navigate('CreateWallet')}>
          <Image source={require('../../../assets/ic_add_method_create.png')} style={styles.btnIcon} resizeMode="contain" />
          <Text style={styles.btnLightText}>Create Wallet</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnDark]} onPress={() => navigation.navigate('ImportWallet')}>
          <Image source={require('../../../assets/ic_add_method_import.png')} style={styles.btnIcon} resizeMode="contain" />
          <Text style={styles.btnDarkText}>Import Wallet</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40 },
  hero: { flex: 1, justifyContent: 'center' },
  logo: { width: 227, height: 48, marginBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1A212B' },
  subtitle: { fontSize: 14, color: '#9BA4B6', marginTop: 10, lineHeight: 20 },
  buttons: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, height: 54, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnLight: { backgroundColor: '#F4F4F7' },
  btnDark: { backgroundColor: '#1A212B' },
  btnIcon: { width: 20, height: 20 },
  btnLightText: { fontSize: 14, fontWeight: 'bold', color: '#1A212B' },
  btnDarkText: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' },
});
```

- [ ] **Step 4: Run — verify PASS** (2 passing; tsc clean).

- [ ] **Step 5: Commit**

```bash
git add src/screens/wallet/EmptyWalletScreen.tsx src/screens/wallet/EmptyWalletScreen.test.tsx
git commit -m "feat(wallet): onboarding entry screen (logo + title + Create/Import)"
```

---

## Task 5: ImportWalletScreen

**Files:**
- Create: `src/screens/wallet/ImportWalletScreen.tsx`
- Test: `src/screens/wallet/ImportWalletScreen.test.tsx`

- [ ] **Step 1: Write the failing test** (mock the container)

```tsx
// src/screens/wallet/ImportWalletScreen.test.tsx
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TextInput } from 'react-native';

const importMnemonic = jest.fn();
const finalizeWallet = jest.fn(async () => {});
jest.mock('../../state/container', () => ({
  container: { keyring: { importMnemonic: (...a: any) => importMnemonic(...a), finalizeWallet: (...a: any) => finalizeWallet(...a) } },
}));

import { ImportWalletScreen } from './ImportWalletScreen';

const nav = (replace = jest.fn()) => ({ replace } as any);

describe('ImportWalletScreen', () => {
  beforeEach(() => { importMnemonic.mockReset(); finalizeWallet.mockClear(); });

  it('imports a valid phrase then replaces to WalletHome', async () => {
    importMnemonic.mockResolvedValue('ref-7');
    const replace = jest.fn();
    let tree: any;
    ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<ImportWalletScreen navigation={nav(replace)} route={{ key: 'i', name: 'ImportWallet' } as any} />); });
    ReactTestRenderer.act(() => { tree.root.findByType(TextInput).props.onChangeText('  word one two  '); });
    await ReactTestRenderer.act(async () => { await tree.root.findByType(require('react-native').Pressable).props.onPress(); });
    expect(importMnemonic).toHaveBeenCalledWith('word one two');
    expect(finalizeWallet).toHaveBeenCalledWith('ref-7');
    expect(replace).toHaveBeenCalledWith('WalletHome');
  });

  it('shows an error and does not navigate on an invalid phrase', async () => {
    importMnemonic.mockRejectedValue(new Error('bad'));
    const replace = jest.fn();
    let tree: any;
    ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<ImportWalletScreen navigation={nav(replace)} route={{ key: 'i', name: 'ImportWallet' } as any} />); });
    ReactTestRenderer.act(() => { tree.root.findByType(TextInput).props.onChangeText('garbage'); });
    await ReactTestRenderer.act(async () => { await tree.root.findByType(require('react-native').Pressable).props.onPress(); });
    expect(replace).not.toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain('Invalid recovery phrase');
  });
});
```

- [ ] **Step 2: Run — verify FAIL** (cannot find `./ImportWalletScreen`).

- [ ] **Step 3: Implement `src/screens/wallet/ImportWalletScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { container } from '../../state/container';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportWallet'>;

export function ImportWalletScreen({ navigation }: Props) {
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onImport = async () => {
    const normalized = phrase.trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    setError('');
    setBusy(true);
    try {
      const ref = await container.keyring.importMnemonic(normalized);
      await container.keyring.finalizeWallet(ref);
      navigation.replace('WalletHome');
    } catch {
      setError('Invalid recovery phrase');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Import Wallet</Text>
      <Text style={styles.label}>Recovery phrase</Text>
      <TextInput
        style={styles.input}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Enter your 12-word recovery phrase"
        placeholderTextColor="#9BA4B6"
        value={phrase}
        onChangeText={setPhrase}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.btn, (!phrase || busy) && styles.btnDisabled]}
        disabled={!phrase || busy}
        onPress={onImport}>
        <Text style={styles.btnText}>Import</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', padding: 20, paddingTop: 80 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A212B', marginBottom: 24 },
  label: { fontSize: 14, color: '#1A212B', marginBottom: 8 },
  input: { minHeight: 120, borderWidth: 1, borderColor: '#F4F4F7', borderRadius: 10, padding: 12, fontSize: 16, color: '#1A212B', textAlignVertical: 'top', backgroundColor: '#FAFAFB' },
  error: { color: '#E5494D', fontSize: 13, marginTop: 8 },
  btn: { height: 54, borderRadius: 10, backgroundColor: '#1A212B', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
});
```

- [ ] **Step 4: Run — verify PASS** (2 passing; tsc clean).

- [ ] **Step 5: Commit**

```bash
git add src/screens/wallet/ImportWalletScreen.tsx src/screens/wallet/ImportWalletScreen.test.tsx
git commit -m "feat(wallet): import-wallet flow (mnemonic -> KeyringService -> WalletHome)"
```

---

## Task 6: CreateWalletScreen

**Files:**
- Create: `src/screens/wallet/CreateWalletScreen.tsx`
- Test: `src/screens/wallet/CreateWalletScreen.test.tsx`

- [ ] **Step 1: Write the failing test** (mock the container)

```tsx
// src/screens/wallet/CreateWalletScreen.test.tsx
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Pressable } from 'react-native';

const createWallet = jest.fn();
const finalizeWallet = jest.fn(async () => {});
jest.mock('../../state/container', () => ({
  container: { keyring: { createWallet: (...a: any) => createWallet(...a), finalizeWallet: (...a: any) => finalizeWallet(...a) } },
}));

import { CreateWalletScreen } from './CreateWalletScreen';

const MNEMONIC = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima';

describe('CreateWalletScreen', () => {
  beforeEach(() => { createWallet.mockReset(); finalizeWallet.mockClear(); });

  it('shows the 12 generated words, then finalizes + replaces to WalletHome after acknowledge', async () => {
    createWallet.mockResolvedValue({ walletRef: 'ref-c', mnemonic: MNEMONIC });
    const replace = jest.fn();
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<CreateWalletScreen navigation={{ replace } as any} route={{ key: 'c', name: 'CreateWallet' } as any} />);
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('alpha');
    expect(json).toContain('lima');
    const pressables = tree.root.findAllByType(Pressable); // [0]=ack row, [1]=Continue
    ReactTestRenderer.act(() => pressables[0].props.onPress()); // acknowledge
    await ReactTestRenderer.act(async () => { await pressables[1].props.onPress(); }); // continue
    expect(finalizeWallet).toHaveBeenCalledWith('ref-c');
    expect(replace).toHaveBeenCalledWith('WalletHome');
  });
});
```

- [ ] **Step 2: Run — verify FAIL** (cannot find `./CreateWalletScreen`).

- [ ] **Step 3: Implement `src/screens/wallet/CreateWalletScreen.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { container } from '../../state/container';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateWallet'>;

export function CreateWalletScreen({ navigation }: Props) {
  const [walletRef, setWalletRef] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    container.keyring.createWallet().then(({ walletRef, mnemonic }) => {
      if (!active) return;
      setWalletRef(walletRef);
      setWords(mnemonic.trim().split(/\s+/));
    });
    return () => { active = false; };
  }, []);

  const onContinue = async () => {
    if (!walletRef) return;
    setBusy(true);
    await container.keyring.finalizeWallet(walletRef);
    navigation.replace('WalletHome');
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Your Recovery Phrase</Text>
      <Text style={styles.warn}>Write these 12 words down in order and keep them somewhere safe. Anyone with this phrase can access your wallet.</Text>
      <View style={styles.grid}>
        {words.map((w, i) => (
          <View key={i} style={styles.cell}>
            <Text style={styles.cellIdx}>{i + 1}</Text>
            <Text style={styles.cellWord}>{w}</Text>
          </View>
        ))}
      </View>
      <Pressable style={styles.ackRow} onPress={() => setAcked(a => !a)}>
        <View style={[styles.checkbox, acked && styles.checkboxOn]}>
          {acked ? <Text style={styles.check}>✓</Text> : null}
        </View>
        <Text style={styles.ackText}>I have written down my recovery phrase</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, (!acked || !walletRef || busy) && styles.btnDisabled]}
        disabled={!acked || !walletRef || busy}
        onPress={onContinue}>
        <Text style={styles.btnText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', padding: 20, paddingTop: 80 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A212B' },
  warn: { fontSize: 13, color: '#9BA4B6', marginTop: 8, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 10 },
  cell: { width: '47%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFB', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12, gap: 8 },
  cellIdx: { fontSize: 13, color: '#9BA4B6', width: 20 },
  cellWord: { fontSize: 15, color: '#1A212B', fontWeight: '600' },
  ackRow: { flexDirection: 'row', alignItems: 'center', marginTop: 28, gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#9BA4B6', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#1A212B', borderColor: '#1A212B' },
  check: { color: '#FFFFFF', fontSize: 13 },
  ackText: { fontSize: 14, color: '#1A212B', flex: 1 },
  btn: { height: 54, borderRadius: 10, backgroundColor: '#1A212B', alignItems: 'center', justifyContent: 'center', marginTop: 'auto' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
});
```

- [ ] **Step 4: Run — verify PASS** (1 passing; tsc clean).

- [ ] **Step 5: Commit**

```bash
git add src/screens/wallet/CreateWalletScreen.tsx src/screens/wallet/CreateWalletScreen.test.tsx
git commit -m "feat(wallet): create-wallet flow (mnemonic backup -> finalize -> WalletHome)"
```

---

## Task 7: WalletHomeScreen (minimal account list)

**Files:**
- Create: `src/screens/wallet/WalletHomeScreen.tsx`
- Test: `src/screens/wallet/WalletHomeScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/wallet/WalletHomeScreen.test.tsx
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useWalletStore } from '../../state/stores/WalletStore';
import { WalletHomeScreen } from './WalletHomeScreen';

describe('WalletHomeScreen', () => {
  it('lists the accounts from WalletStore', () => {
    useWalletStore.setState({
      walletRef: 'r', locked: false,
      accounts: [
        { caip2: 'eip155:1', name: 'Ethereum', address: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94', nativeSymbol: 'ETH' },
        { caip2: 'tron:728126428', name: 'TRON', address: 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH', nativeSymbol: 'TRX' },
      ],
    });
    let tree: any;
    ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<WalletHomeScreen navigation={{} as any} route={{ key: 'h', name: 'WalletHome' } as any} />); });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Ethereum');
    expect(json).toContain('TRON');
    expect(json).toContain('TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH');
  });

  it('shows an empty state when there are no accounts', () => {
    useWalletStore.setState({ walletRef: undefined, locked: true, accounts: [] });
    let tree: any;
    ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<WalletHomeScreen navigation={{} as any} route={{ key: 'h', name: 'WalletHome' } as any} />); });
    expect(JSON.stringify(tree.toJSON())).toContain('No accounts');
  });
});
```

- [ ] **Step 2: Run — verify FAIL** (cannot find `./WalletHomeScreen`).

- [ ] **Step 3: Implement `src/screens/wallet/WalletHomeScreen.tsx`**

```tsx
import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useWalletStore } from '../../state/stores/WalletStore';

type Props = NativeStackScreenProps<RootStackParamList, 'WalletHome'>;

export function WalletHomeScreen(_props: Props) {
  const accounts = useWalletStore(s => s.accounts);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>My Wallet</Text>
      {accounts.length === 0 ? (
        <Text style={styles.empty}>No accounts</Text>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={a => a.caip2}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.chain}>{item.name}</Text>
              <Text style={styles.addr} numberOfLines={1} ellipsizeMode="middle">{item.address}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', padding: 20, paddingTop: 80 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A212B', marginBottom: 20 },
  empty: { fontSize: 14, color: '#9BA4B6' },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F4F4F7' },
  chain: { fontSize: 15, fontWeight: '600', color: '#1A212B' },
  addr: { fontSize: 13, color: '#9BA4B6', marginTop: 4 },
});
```

- [ ] **Step 4: Run — verify PASS** (2 passing; tsc clean).

- [ ] **Step 5: Commit**

```bash
git add src/screens/wallet/WalletHomeScreen.tsx src/screens/wallet/WalletHomeScreen.test.tsx
git commit -m "feat(wallet): minimal WalletHome (account list from WalletStore)"
```

---

## Task 8: Register routes in App.tsx

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add the three screens to the stack**

In `App.tsx`, add the imports and `Stack.Screen` entries:
```tsx
import { CreateWalletScreen } from './src/screens/wallet/CreateWalletScreen';
import { ImportWalletScreen } from './src/screens/wallet/ImportWalletScreen';
import { WalletHomeScreen } from './src/screens/wallet/WalletHomeScreen';
```
and inside `<Stack.Navigator …>` after the `EmptyWallet` screen:
```tsx
          <Stack.Screen name="CreateWallet" component={CreateWalletScreen} />
          <Stack.Screen name="ImportWallet" component={ImportWalletScreen} />
          <Stack.Screen name="WalletHome" component={WalletHomeScreen} />
```

- [ ] **Step 2: Run — full suite + tsc**

Run: `yarn jest --watchman=false 2>&1 | tail -6` and `yarn tsc --noEmit`.
Expected: all green (the App smoke test still renders the navigation root to Welcome; new routes are reachable). If the App test's `react-native-screens` mock needs more stubs because more Screen components mount, extend it as in the prior welcome-screen task; do not weaken the test.

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat: register CreateWallet/ImportWallet/WalletHome routes"
```

---

## Task 9: On-device validation (both platforms)

**Files:**
- Create: `src/devtools/OnboardingSelfTest.ts`
- Modify: `src/screens/dev/DevSelfTestScreen.tsx`

- [ ] **Step 1: Add an on-device onboarding probe**

```typescript
// src/devtools/OnboardingSelfTest.ts
import { container } from '../state/container';
import { useWalletStore } from '../state/stores/WalletStore';
import { GOLDEN } from '../crypto/goldenVectors';

export type Line = { name: string; ok: boolean; detail: string };

export async function runOnboardingSelfTest(): Promise<Line[]> {
  const out: Line[] = [];

  // createWallet: fresh 12-word mnemonic + a usable wallet (derivable addresses).
  const created = await container.keyring.createWallet();
  const words = created.mnemonic.trim().split(/\s+/);
  out.push({ name: 'createWallet 12 words', ok: words.length === 12, detail: `${words.length} words` });
  await container.keyring.finalizeWallet(created.walletRef);
  const createdAccts = useWalletStore.getState().accounts;
  const createdTron = createdAccts.find(a => a.caip2 === 'tron:728126428')?.address ?? '';
  out.push({ name: 'created wallet derives TRON addr', ok: createdTron.startsWith('T') && createdTron.length === 34, detail: createdTron });

  // import the golden mnemonic -> WalletStore shows the golden addresses.
  const ref = await container.keyring.importMnemonic(GOLDEN.mnemonic);
  await container.keyring.finalizeWallet(ref);
  const accts = useWalletStore.getState().accounts;
  const evm = accts.find(a => a.caip2 === 'eip155:1')?.address;
  const tron = accts.find(a => a.caip2 === 'tron:728126428')?.address;
  out.push({ name: 'import golden -> EVM', ok: evm === GOLDEN.evm.expectedAddress, detail: String(evm) });
  out.push({ name: 'import golden -> TRON', ok: tron === GOLDEN.tron.expectedAddress, detail: String(tron) });
  return out;
}
```

- [ ] **Step 2: Wire it into `DevSelfTestScreen`**

In `src/screens/dev/DevSelfTestScreen.tsx`, add the import + a `runAndLog('ONBOARD', runOnboardingSelfTest, setOnboard)` probe + a `useState` + a rendered panel (follow the existing probe pattern; add `import { runOnboardingSelfTest } from '../../devtools/OnboardingSelfTest';`).

- [ ] **Step 3: Keep Jest + tsc green** (`yarn tsc --noEmit`; `yarn jest --watchman=false` — the App render test mounts DevSelfTest indirectly only if navigated; the probe uses the mocked bridge so it's render-safe). Report totals.

- [ ] **Step 4: Android device run**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
npx react-native run-android
# capture the entry screen (after JS loads + Welcome auto-advances):
adb shell am force-stop com.tronlinkrn; adb shell monkey -p com.tronlinkrn -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 5; adb exec-out screencap -p > /tmp/onb_entry.png
# drive to DevSelfTest to run the ONBOARD probe (tap the dev link on EmptyWallet is gone — the entry is the redesign; instead navigate via the DevSelfTest route from EmptyWallet if you kept a dev link, OR temporarily check the ONBOARD logs):
adb logcat -d | grep -E "ONBOARD_" | tail
```
Inspect `/tmp/onb_entry.png` (Read tool): it must show the redesigned EmptyWallet entry (logo + "Well-Rounded TRON Features" + Create/Import buttons). Confirm `ONBOARD_RESULT=ALL_PASS` if the DevSelfTest screen was reached (createWallet 12 words + derives TRON; import golden → golden EVM/TRON). NOTE: the DevSelfTest link moved off EmptyWallet (the entry is the redesign). To reach DevSelfTest for the probe, navigate from a Metro dev menu or temporarily wire a dev entry; capturing `ONBOARD_RESULT` is secondary to the entry screenshot + the Jest coverage.

- [ ] **Step 5: iOS device run**

```bash
npx react-native start --client-logs > /tmp/m-onb.log 2>&1 &
npx react-native run-ios --simulator "iPhone 17 Pro"
sleep 6; xcrun simctl io booted screenshot /tmp/onb_entry_ios.png
grep -E "ONBOARD_" /tmp/m-onb.log | tail
```
Inspect `/tmp/onb_entry_ios.png`: redesigned entry screen. Visually compare the entry to the Android `EmptyWalletActivity` (simplified — logo + title + two buttons).

- [ ] **Step 6: Drive the flows (best-effort)** — on the simulator/emulator, tap "Import Wallet", paste the golden mnemonic (`adb shell input text` / simulator type), tap Import → confirm it lands on `WalletHome` showing the golden TRON/EVM addresses. Tap "Create Wallet" → 12 words shown → check acknowledge → Continue → `WalletHome` shows derived addresses. Capture screenshots. If headless driving is unreliable, rely on the Jest tests + the `ONBOARD` probe + the entry screenshot, and note what was visually confirmed.

- [ ] **Step 7: Commit**

```bash
git add src/devtools/OnboardingSelfTest.ts src/screens/dev/DevSelfTestScreen.tsx
git commit -m "test: on-device onboarding probe (createWallet + import golden) + entry verified"
```

---

## Self-Review

**Spec coverage:**
- Entry screen (simplified EmptyWalletActivity: logo + title + subtitle + Create/Import buttons w/ icons) → Tasks 1/4. ✅
- Create flow (createWallet → mnemonic backup + acknowledge → finalize → home) → Tasks 2/3/6. ✅
- Import flow (mnemonic input → importMnemonic → finalize → home; invalid → error) → Tasks 3/5. ✅
- WalletHome (minimal account list from WalletStore) → Task 7. ✅
- Native bridge `createWallet` (TWCore, both platforms, codegen) → Task 2. ✅
- State-layer wiring (KeyringService.createWallet/finalizeWallet, container singleton, UI reads via store selector) → Tasks 3/4/5/6/7. ✅
- Reused create/import icons → Task 1. ✅
- Simplifications (no carousel/cold-wallet/other-options/passcode/private-key-import/verify-quiz) → by omission (none built). ✅
- Security note (mnemonic transits JS on create/import; signing stays native) → honored: only `createWallet`/`importMnemonic` move the mnemonic; signing path untouched. ✅
- Device validation both platforms → Task 9. ✅

**Placeholder scan:** Real code in every step. `WalletHome` is an intentional minimal screen (declared in spec). Task 9's headless UI-driving has an explicit best-effort fallback (Jest + probe + screenshot). No "TBD"/"add error handling"/"similar to".

**Type consistency:** `CreatedWallet = { walletRef, mnemonic }` (Task 2) is the return of `SecureKeyring.createWallet` + `KeyringService.createWallet` (Task 3), consumed by `CreateWalletScreen` (Task 6). `KeyringService.finalizeWallet(walletRef)` (Task 3) is called by both flow screens (Tasks 5/6). `container` singleton (Task 3) imported by Import/Create screens (Tasks 5/6). `RootStackParamList` routes `EmptyWallet`/`CreateWallet`/`ImportWallet`/`WalletHome` (Task 1) used by every screen's `NativeStackScreenProps<…, '<Route>'>` and the `Stack.Screen name=` values (Task 8); `navigation.navigate('CreateWallet'|'ImportWallet')` (Task 4) and `navigation.replace('WalletHome')` (Tasks 5/6) reference real routes. `useWalletStore` selector `s => s.accounts` + `setWallet(walletRef, accounts)` consistent with the Phase state-layer store. `buildAccountTree` (multichain) returns `ChainAccount[]` consumed by WalletStore + WalletHome.
