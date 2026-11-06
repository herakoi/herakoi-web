/** Version of the running build, shown in the settings. */
export const appVersion = {
  version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev",
  commit: typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "unknown",
};

let registration: ServiceWorkerRegistration | undefined;

/** Called once the service worker is registered (see main.tsx). */
export const setServiceWorkerRegistration = (next: ServiceWorkerRegistration | undefined) => {
  registration = next;
};

export type UpdateCheckResult = "updating" | "upToDate" | "unavailable" | "failed";

/**
 * Ask the server for a newer service worker. The worker is registered with
 * `autoUpdate`, so a newer one activates on its own and the page reloads.
 */
export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  if (!registration) return "unavailable";
  try {
    await registration.update();
  } catch {
    return "failed";
  }
  return registration.installing || registration.waiting ? "updating" : "upToDate";
};
