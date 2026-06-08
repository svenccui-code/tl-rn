import { create } from 'zustand';

interface NetworkState {
  selectedCaip2: string;
  nodeByChain: Record<string, string>;
  setChain(caip2: string): void;
  setNode(caip2: string, node: string): void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  selectedCaip2: 'tron:728126428',
  nodeByChain: {},
  setChain: (caip2) => set({ selectedCaip2: caip2 }),
  setNode: (caip2, node) => set((s) => ({ nodeByChain: { ...s.nodeByChain, [caip2]: node } })),
}));
