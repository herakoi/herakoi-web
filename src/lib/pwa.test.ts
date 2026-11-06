import { afterEach, describe, expect, it, vi } from "vitest";
import { checkForUpdate, setServiceWorkerRegistration } from "./pwa";

const fakeRegistration = (afterUpdate: Partial<ServiceWorkerRegistration>) => {
  const registration = {
    installing: null,
    waiting: null,
    update: vi.fn(async () => {
      Object.assign(registration, afterUpdate);
    }),
  };
  return registration as unknown as ServiceWorkerRegistration;
};

describe("checkForUpdate", () => {
  afterEach(() => setServiceWorkerRegistration(undefined));

  it("reports unavailable without a registered service worker", async () => {
    expect(await checkForUpdate()).toBe("unavailable");
  });

  it("reports up to date when the server has no new worker", async () => {
    const registration = fakeRegistration({});
    setServiceWorkerRegistration(registration);
    expect(await checkForUpdate()).toBe("upToDate");
    expect(registration.update).toHaveBeenCalledOnce();
  });

  it("reports updating when a new worker is installing", async () => {
    setServiceWorkerRegistration(fakeRegistration({ installing: {} as ServiceWorker }));
    expect(await checkForUpdate()).toBe("updating");
  });

  it("reports updating when a new worker is waiting", async () => {
    setServiceWorkerRegistration(fakeRegistration({ waiting: {} as ServiceWorker }));
    expect(await checkForUpdate()).toBe("updating");
  });

  it("reports failed when the check cannot reach the server", async () => {
    const registration = fakeRegistration({});
    vi.mocked(registration.update).mockRejectedValueOnce(new TypeError("offline"));
    setServiceWorkerRegistration(registration);
    expect(await checkForUpdate()).toBe("failed");
  });
});
