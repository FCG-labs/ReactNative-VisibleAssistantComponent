export interface VacClientOptions {
  host?: string;
  port?: number;
  /** WebSocket auth token (required) */
  token: string;
  app?: string;
  appVersion?: string;
  reconnect?: {
    baseMs?: number;
    maxMs?: number;
  };
  /** Enable automatic discovery via resolver() */
  discover?: boolean;
  /** Injected env vars for React-Native (process.env not available) */
  env?: {
    VAC_HOST?: string;
    VAC_PORT?: string | number;
    VAC_TOKEN?: string;
  };
  /** Optional host resolver (e.g. mDNS) */
  resolver?: () => string | { host: string; port: number; token?: string };
  /** Config object (e.g. loaded from .vacrc.json) */
  config?: { host: string; port: number; token?: string };
}

export interface NavigatorSnapshot {
  /** List of unique screen names */
  screens: string[];
  /** Optional explicit edges for non-linear graphs */
  edges?: { source: string; target: string }[];
}

export interface VacClient {
  /** Low-level send helper, string or object */
  send(msg: unknown): boolean;
  /** Close underlying WebSocket and stop reconnect */
  close(): void;
  /** Subscribe to lifecycle events. Returns unsubscribe fn. */
  on(
    event: 'open' | 'close' | 'error' | 'message',
    handler: (...args: any[]) => void
  ): () => void;
  /** Publish current navigator snapshot to Host */
  publishNavigatorSnapshot(snapshot: NavigatorSnapshot): boolean;
}

/**
 * Create and connect a VAC client.
 * Automatically attempts reconnection using exponential back-off.
 */
export function createVacClient(
  options: Partial<VacClientOptions>
): VacClient;

/**
 * Extract screen list from React Navigation state tree.
 */
export function buildSnapshotFromReactNavigation(
  state: any
): NavigatorSnapshot;
