const POLL_INTERVAL_MS = 5 * 60 * 1000;

async function fetchVersion(): Promise<string | null> {
  try {
    const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export function startVersionPolling(onUpdateAvailable: () => void): void {
  let baselineVersion: string | null = null;
  let stopped = false;

  async function check(): Promise<void> {
    if (stopped) return;
    const latest = await fetchVersion();
    if (latest === null) return;

    if (baselineVersion === null) {
      baselineVersion = latest;
      return;
    }

    if (latest !== baselineVersion) {
      stopped = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      onUpdateAvailable();
    }
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') void check();
  }

  const intervalId = setInterval(() => void check(), POLL_INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);
  void check();
}
