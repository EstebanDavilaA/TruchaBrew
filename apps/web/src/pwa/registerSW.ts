// M42_P2 — PWA service-worker registration (RA-6).
//
// A pure decision (`shouldRegisterServiceWorker`) gates a stateful
// registration (`registerServiceWorker`) that takes injectable dependencies
// so every branch is unit-testable. Registration happens only when `isProd`
// is true AND a service worker container is available; otherwise it is a
// no-op resolving `false`. Any `register()` rejection is caught and resolves
// `false`. Never throws in any path.

export const SERVICE_WORKER_URL = '/sw.js';

export interface SWRegistrationDeps {
  isProd: boolean;
  serviceWorker: { register(url: string, opts?: RegistrationOptions): Promise<unknown> } | undefined;
}

export function shouldRegisterServiceWorker(input: { isProd: boolean; serviceWorkerAvailable: boolean }): boolean {
  return input.isProd && input.serviceWorkerAvailable;
}

export function defaultSWDeps(): SWRegistrationDeps {
  return {
    isProd: import.meta.env.PROD,
    serviceWorker: ('serviceWorker' in navigator) ? navigator.serviceWorker : undefined,
  };
}

export async function registerServiceWorker(deps: SWRegistrationDeps = defaultSWDeps()): Promise<boolean> {
  if (!shouldRegisterServiceWorker({ isProd: deps.isProd, serviceWorkerAvailable: deps.serviceWorker != null })) {
    return false;
  }
  try {
    await deps.serviceWorker!.register(SERVICE_WORKER_URL);
    return true;
  } catch {
    return false;
  }
}
