export interface ProviderRequest { id: number; method: string; params: unknown[]; }
export interface ProviderResponse { id: number; result?: unknown; error?: { code: number; message: string }; }
export class ProviderRpcError extends Error {
  constructor(public code: number, message: string) { super(message); }
}
