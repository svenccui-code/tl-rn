import { create } from 'zustand';

type Key = `${string}:${string}`;
interface AssetsState {
  nativeBalance: Record<Key, bigint>;
  setNativeBalance(caip2: string, address: string, v: bigint): void;
}

export const useAssetsStore = create<AssetsState>((set) => ({
  nativeBalance: {},
  setNativeBalance: (caip2, address, v) =>
    set((s) => ({ nativeBalance: { ...s.nativeBalance, [`${caip2}:${address}`]: v } })),
}));
