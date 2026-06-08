import { create } from 'zustand';

export interface TrackedTx {
  caip2: string; hash: string; summary: string;
  status: 'pending' | 'confirmed'; success?: boolean;
}
interface TxState {
  byHash: Record<string, TrackedTx>;
  addPending(tx: { caip2: string; hash: string; summary: string }): void;
  setConfirmed(hash: string, success: boolean): void;
}

export const useTxStore = create<TxState>((set) => ({
  byHash: {},
  addPending: (tx) => set((s) => ({ byHash: { ...s.byHash, [tx.hash]: { ...tx, status: 'pending' } } })),
  setConfirmed: (hash, success) => set((s) => {
    const prev = s.byHash[hash];
    if (!prev) return s;
    return { byHash: { ...s.byHash, [hash]: { ...prev, status: 'confirmed', success } } };
  }),
}));
