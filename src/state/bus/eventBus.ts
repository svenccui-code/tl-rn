import mitt from 'mitt';
import type { AppEvents } from './events';

// Typed pub/sub — the lightweight "Messenger". Cross-domain notification only;
// single-ownership + import boundaries replace MetaMask's restricted-messenger allowlist.
export const bus = mitt<AppEvents>();
