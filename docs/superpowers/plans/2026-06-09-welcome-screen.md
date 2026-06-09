# Welcome Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pixel-identical React Native replica of the existing Android `WelcomeActivity` welcome/launch screen as the app's first UI screen, with React Navigation set up (`Welcome` → `EmptyWallet` placeholder), and the existing device self-tests preserved behind a `DevSelfTest` route.

**Architecture:** `App.tsx` becomes a `SafeAreaProvider` + `NavigationContainer` + native-stack with three routes. `WelcomeScreen` (white background + the TronLink logo centered at vertical bias 0.4) auto-`replace`s to `EmptyWallet` after a 1.1s timer. Screens are organized by business domain under `src/screens/<domain>/`. No HD-upgrade logic, no state-layer bootstrap (plain timer) — per the spec.

**Tech Stack:** React Native 0.84 · `@react-navigation/native` + `@react-navigation/native-stack` + `react-native-screens` · existing `react-native-safe-area-context` · Jest + react-test-renderer.

**Spec:** [`docs/superpowers/specs/2026-06-09-welcome-screen-design.md`](../specs/2026-06-09-welcome-screen-design.md)

---

## File Structure

| File | Responsibility |
| --- | --- |
| `assets/ic_launcher_pic.png` | TronLink logo, copied from Android `mipmap-xxhdpi/ic_launcher_pic.png` (681×144, 3x) |
| `src/navigation/types.ts` | `RootStackParamList` shared route-param type |
| `src/screens/welcome/WelcomeScreen.tsx` | pixel-identical welcome UI + 1.1s timed `navigation.replace('EmptyWallet')` |
| `src/screens/wallet/EmptyWalletScreen.tsx` | placeholder stub ("Create / Import Wallet — coming soon") + dev link |
| `src/screens/dev/DevSelfTestScreen.tsx` | the current `App.tsx` self-test probes, moved verbatim (paths adjusted) |
| `App.tsx` | providers + `NavigationContainer` + native-stack navigator |
| `__tests__/App.test.tsx` | updated smoke test for the navigation root |

---

## Task 1: Logo asset + navigation dependencies

**Files:**
- Create: `assets/ic_launcher_pic.png`
- Modify: `package.json`, `ios/Podfile.lock`

- [ ] **Step 1: Copy the logo asset**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
mkdir -p assets
cp ../tronlink-android/app/src/main/res/mipmap-xxhdpi/ic_launcher_pic.png assets/ic_launcher_pic.png
sips -g pixelWidth -g pixelHeight assets/ic_launcher_pic.png | grep pixel
```
Expected: file copied; dimensions `pixelWidth: 681`, `pixelHeight: 144`.

- [ ] **Step 2: Add navigation deps**

```bash
yarn add @react-navigation/native @react-navigation/native-stack react-native-screens
(cd ios && pod install)
```
Expected: installs succeed; `pod install` autolinks `react-native-screens` (`ios/Podfile.lock` updated). Record resolved versions. (native-stack does NOT require react-native-gesture-handler.)

- [ ] **Step 3: Smoke — Jest + tsc still green**

Run: `yarn jest --watchman=false 2>&1 | tail -4` and `yarn tsc --noEmit`.
Expected: all current suites pass (nothing wired yet); tsc clean.

- [ ] **Step 4: Commit**

```bash
git add assets/ic_launcher_pic.png package.json yarn.lock ios/Podfile.lock
git commit -m "build: add navigation deps + TronLink welcome logo asset"
```

---

## Task 2: WelcomeScreen (pixel-faithful) + route types

**Files:**
- Create: `src/navigation/types.ts`, `src/screens/welcome/WelcomeScreen.tsx`
- Test: `src/screens/welcome/WelcomeScreen.test.tsx`

- [ ] **Step 1: Write the route-param type**

```typescript
// src/navigation/types.ts
export type RootStackParamList = {
  Welcome: undefined;
  EmptyWallet: undefined;
  DevSelfTest: undefined;
};
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/screens/welcome/WelcomeScreen.test.tsx
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { WelcomeScreen } from './WelcomeScreen';

jest.useFakeTimers();

describe('WelcomeScreen', () => {
  it('replaces to EmptyWallet after the 1.1s splash delay', () => {
    const replace = jest.fn();
    const nav = { replace } as any;
    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(<WelcomeScreen navigation={nav} route={{ key: 'w', name: 'Welcome' } as any} />);
    });
    expect(replace).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => { jest.advanceTimersByTime(1100); });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('EmptyWallet');
  });

  it('clears the timer on unmount (no navigation after unmount)', () => {
    const replace = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<WelcomeScreen navigation={{ replace } as any} route={{ key: 'w', name: 'Welcome' } as any} />);
    });
    ReactTestRenderer.act(() => { tree.unmount(); });
    ReactTestRenderer.act(() => { jest.advanceTimersByTime(1100); });
    expect(replace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn jest src/screens/welcome/WelcomeScreen.test.tsx --watchman=false`
Expected: FAIL — cannot find `./WelcomeScreen`.

- [ ] **Step 4: Implement WelcomeScreen**

```tsx
// src/screens/welcome/WelcomeScreen.tsx
import React, { useEffect } from 'react';
import { View, Image, StatusBar, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

// Matches Android WelcomeActivity: ~1.1s splash, then go to the next screen.
const SPLASH_DELAY_MS = 1100;

export function WelcomeScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('EmptyWallet'), SPLASH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* vertical_bias=0.4 reproduced by a 0.4 : 0.6 top/bottom spacer ratio */}
      <View style={styles.topSpacer} />
      <Image
        source={require('../../../assets/ic_launcher_pic.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.bottomSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center' },
  topSpacer: { flex: 0.4 },
  bottomSpacer: { flex: 0.6 },
  logo: { width: 227, height: 48 }, // 681×144 @3x → 227×48 dp
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn jest src/screens/welcome/WelcomeScreen.test.tsx --watchman=false`
Expected: PASS (2 passing). Then `yarn tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add src/navigation/types.ts src/screens/welcome/WelcomeScreen.tsx src/screens/welcome/WelcomeScreen.test.tsx
git commit -m "feat(welcome): pixel-faithful WelcomeScreen + splash transition"
```

---

## Task 3: EmptyWallet placeholder screen

**Files:**
- Create: `src/screens/wallet/EmptyWalletScreen.tsx`
- Test: `src/screens/wallet/EmptyWalletScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/wallet/EmptyWalletScreen.test.tsx
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { EmptyWalletScreen } from './EmptyWalletScreen';

it('renders the placeholder without crashing', () => {
  let tree: any;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<EmptyWalletScreen navigation={{ navigate: jest.fn() } as any} route={{ key: 'e', name: 'EmptyWallet' } as any} />);
  });
  const text = JSON.stringify(tree.toJSON());
  expect(text).toContain('Create / Import Wallet');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest src/screens/wallet/EmptyWalletScreen.test.tsx --watchman=false`
Expected: FAIL — cannot find `./EmptyWalletScreen`.

- [ ] **Step 3: Implement**

```tsx
// src/screens/wallet/EmptyWalletScreen.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EmptyWallet'>;

// Placeholder for the future create/import-wallet entry (Android EmptyWalletActivity).
export function EmptyWalletScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Create / Import Wallet</Text>
      <Text style={styles.sub}>coming soon</Text>
      {__DEV__ && (
        <Pressable onPress={() => navigation.navigate('DevSelfTest')} style={styles.devBtn}>
          <Text style={styles.devText}>Dev self-tests →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: '#1A212B' },
  sub: { fontSize: 14, color: '#8A93A6', marginTop: 8 },
  devBtn: { marginTop: 40, paddingVertical: 8, paddingHorizontal: 16 },
  devText: { fontSize: 14, color: '#2F6BFF' },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest src/screens/wallet/EmptyWalletScreen.test.tsx --watchman=false`
Expected: PASS. Then `yarn tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/screens/wallet/EmptyWalletScreen.tsx src/screens/wallet/EmptyWalletScreen.test.tsx
git commit -m "feat(wallet): EmptyWallet placeholder screen + dev link"
```

---

## Task 4: Move device self-tests into `DevSelfTestScreen`

The current `App.tsx` content moves verbatim into a screen component. Only two things change: the default export `App` becomes the named export `DevSelfTestScreen`, and the `./src/devtools/...` import paths become `../../devtools/...` (the file moves from repo root to `src/screens/dev/`).

**Files:**
- Create: `src/screens/dev/DevSelfTestScreen.tsx`

- [ ] **Step 1: Create the screen (current App.tsx body, paths adjusted)**

```tsx
// src/screens/dev/DevSelfTestScreen.tsx
import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, Button, View } from 'react-native';
import { runBridgeSelfTest, Line } from '../../devtools/BridgeSelfTest';
import { runReadOnlySelfTest } from '../../devtools/ReadOnlySelfTest';
import { runEvmSignSelfTest } from '../../devtools/EvmSignSelfTest';
import { runTronSignSelfTest } from '../../devtools/TronSignSelfTest';
import { runStateLayerSelfTest } from '../../devtools/StateLayerSelfTest';

async function runAndLog(tag: string, fn: () => Promise<Line[]>, set: (l: Line[]) => void) {
  try {
    const lines = await fn();
    set(lines);
    const allOk = lines.every(l => l.ok);
    console.log(`${tag}_BEGIN`);
    lines.forEach(l => console.log(`${tag}_LINE ${l.ok ? 'PASS' : 'FAIL'} ${l.name} | ${l.detail}`));
    console.log(`${tag}_RESULT=${allOk ? 'ALL_PASS' : 'FAIL'}`);
    console.log(`${tag}_END`);
  } catch (e) {
    console.log(`${tag}_RESULT=ERROR ${String(e)}`);
  }
}

export function DevSelfTestScreen() {
  const [bridge, setBridge] = useState<Line[]>([]);
  const [readonly, setReadonly] = useState<Line[]>([]);
  const [evmSign, setEvmSign] = useState<Line[]>([]);
  const [tronSign, setTronSign] = useState<Line[]>([]);
  const [stateLayer, setStateLayer] = useState<Line[]>([]);
  const runAll = () => {
    runAndLog('SELFTEST', runBridgeSelfTest, setBridge);
    runAndLog('READONLY', runReadOnlySelfTest, setReadonly);
    runAndLog('EVMSIGN', runEvmSignSelfTest, setEvmSign);
    runAndLog('TRONSIGN', runTronSignSelfTest, setTronSign);
    runAndLog('STATELAYER', runStateLayerSelfTest, setStateLayer);
  };
  useEffect(() => { runAll(); }, []);
  const render = (title: string, lines: Line[]) => (
    <View>
      <Text style={{ fontSize: 18, marginTop: 12 }}>
        {title}: {lines.length === 0 ? '…' : lines.every(l => l.ok) ? '✅ ALL PASS' : '❌ FAIL'}
      </Text>
      {lines.map((l, i) => (
        <Text key={i}>{l.ok ? '✅' : '❌'} {l.name}: {l.detail}</Text>
      ))}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Button title="Re-run" onPress={runAll} />
      <ScrollView>
        {render('SecureKeyring', bridge)}
        {render('Read-only multichain', readonly)}
        {render('EVM sign golden', evmSign)}
        {render('TRON sign golden', tronSign)}
        {render('State layer (zustand/mitt)', stateLayer)}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: clean (the screen compiles; `App.tsx` still has the old content until Task 5 — no conflict yet).

- [ ] **Step 3: Commit**

```bash
git add src/screens/dev/DevSelfTestScreen.tsx
git commit -m "refactor(dev): move device self-tests into DevSelfTestScreen"
```

---

## Task 5: App.tsx → NavigationContainer + native-stack

**Files:**
- Modify: `App.tsx` (replace entirely)
- Modify: `__tests__/App.test.tsx`

- [ ] **Step 1: Replace `App.tsx`**

```tsx
// App.tsx
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import type { RootStackParamList } from './src/navigation/types';
import { WelcomeScreen } from './src/screens/welcome/WelcomeScreen';
import { EmptyWalletScreen } from './src/screens/wallet/EmptyWalletScreen';
import { DevSelfTestScreen } from './src/screens/dev/DevSelfTestScreen';

enableScreens();
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="EmptyWallet" component={EmptyWalletScreen} />
          <Stack.Screen name="DevSelfTest" component={DevSelfTestScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Update the App smoke test**

The old `__tests__/App.test.tsx` asserted the self-test render; App is now a navigation root. Replace it with a render-without-crash smoke test, mocking `react-native-screens` (its native module isn't available in Jest):

```tsx
// __tests__/App.test.tsx
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
  // minimal stubs so native-stack renders under react-test-renderer
  ScreenStack: ({ children }: any) => children,
  Screen: ({ children }: any) => children,
}));
jest.useFakeTimers();

import App from '../App';

it('renders the navigation root to the Welcome screen', () => {
  let tree: any;
  ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<App />); });
  expect(tree).toBeTruthy();
  ReactTestRenderer.act(() => { jest.clearAllTimers(); });
});
```
If `react-native-screens` still errors in Jest, extend the mock with the components the error names (e.g. `ScreenStackHeaderConfig`, `ScreenContainer`) as pass-through `({children}) => children`. If `@react-navigation` needs more (rare with react-test-renderer), the alternative is to render `WelcomeScreen` directly (already covered in Task 2) and keep this App test minimal — but prefer mounting `<App/>` to prove the wiring.

- [ ] **Step 3: Run — full suite + tsc**

Run: `yarn jest --watchman=false 2>&1 | tail -6` and `yarn tsc --noEmit`.
Expected: ALL suites pass (incl. the new App smoke + WelcomeScreen + EmptyWalletScreen); tsc clean. Fix the `react-native-screens` mock if the App test reports a missing export.

- [ ] **Step 4: Commit**

```bash
git add App.tsx __tests__/App.test.tsx
git commit -m "feat: navigation root (Welcome -> EmptyWallet) + DevSelfTest route"
```

---

## Task 6: On-device verification (both platforms)

**Files:** none (verification + any fixes)

- [ ] **Step 1: Android**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
npx react-native run-android   # Metro running
```
Expected: app launches to the **Welcome screen** — white background, TronLink logo centered horizontally at ~40% height — then after ~1.1s auto-advances to the **EmptyWallet** placeholder ("Create / Import Wallet — coming soon" + "Dev self-tests →"). Tap "Dev self-tests →" → `DevSelfTest` screen; confirm the logs still show `SELFTEST_RESULT=ALL_PASS`, `READONLY_RESULT=ALL_PASS`, `EVMSIGN_RESULT=ALL_PASS`, `TRONSIGN_RESULT=ALL_PASS`, `STATELAYER_RESULT=ALL_PASS` (`adb logcat -d | grep _RESULT`).

- [ ] **Step 2: iOS**

```bash
npx react-native start --client-logs > /tmp/m-welcome.log 2>&1 &
npx react-native run-ios --simulator "iPhone 17 Pro"
```
Expected: same — Welcome (white + centered logo) → EmptyWallet after ~1.1s; navigating to DevSelfTest runs the probes (`grep _RESULT /tmp/m-welcome.log`). Visually compare the Welcome screen to the Android app (`tronlink-android`) for pixel fidelity (logo position/size).

- [ ] **Step 3: Commit any device fixes** (e.g., if `enableScreens()` or a status-bar tweak is needed). If no changes were required, skip.

```bash
git commit -am "fix(welcome): device adjustments for pixel fidelity"
```

---

## Self-Review

**Spec coverage:**
- Pixel-identical Welcome (white bg + logo, vertical bias 0.4 via 0.4:0.6 spacers, real asset) → Task 2. ✅
- HD-upgrade logic/UI removed (not present anywhere) → by omission. ✅
- 1.1s timed `navigation.replace('EmptyWallet')`, no state-layer bootstrap → Task 2. ✅
- React Navigation native-stack, Welcome initial → EmptyWallet placeholder → Tasks 3/5. ✅
- Self-tests moved to `DevSelfTest` route → Tasks 4/5. ✅
- Screens by business domain `src/screens/<domain>/` → Tasks 2/3/4. ✅
- Asset copied from Android xxhdpi → Task 1. ✅
- Device verification both platforms → Task 6. ✅

**Placeholder scan:** `EmptyWalletScreen` is an intentional, declared placeholder (spec scope), not a lazy TODO. Real code in every step. The only flagged uncertainty (`react-native-screens` Jest mock breadth) has explicit fallback instructions. No "TBD"/"add error handling"/"similar to".

**Type consistency:** `RootStackParamList` (Task 2) has routes `Welcome`/`EmptyWallet`/`DevSelfTest`, used by `WelcomeScreen` (`NativeStackScreenProps<…,'Welcome'>`), `EmptyWalletScreen` (`…'EmptyWallet'`), and `App.tsx`'s `createNativeStackNavigator<RootStackParamList>()` + `Stack.Screen name=` values — all consistent. `WelcomeScreen` calls `navigation.replace('EmptyWallet')` (a real route). `EmptyWalletScreen` calls `navigation.navigate('DevSelfTest')` (a real route). `DevSelfTestScreen` is a named export imported by `App.tsx`. The `Line` type comes from `../../devtools/BridgeSelfTest` (unchanged, paths shifted by one level for the moved file).
