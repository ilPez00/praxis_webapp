/**
 * @vitest-environment jsdom
 */

const mockConsoleDebug = vi.fn();
const mockConsoleWarn = vi.fn();
const originalConsole = console;

beforeAll(() => {
  console.debug = mockConsoleDebug;
  console.warn = mockConsoleWarn;
});

afterAll(() => {
  console.debug = originalConsole.debug;
  console.warn = originalConsole.warn;
});

beforeEach(() => {
  mockConsoleDebug.mockClear();
  mockConsoleWarn.mockClear();
  localStorage.clear();
});

describe('enforceFreshContent', () => {
  it('does nothing when version matches', async () => {
    localStorage.setItem('praxis_app_version', '2026.03.12.v4');
    const { enforceFreshContent } = await import('../../utils/versionControl');
    enforceFreshContent();
    expect(localStorage.getItem('praxis_app_version')).toBe('2026.03.12.v4');
  });

  it('updates version when mismatched', async () => {
    localStorage.setItem('praxis_app_version', 'old-version');
    const { enforceFreshContent } = await import('../../utils/versionControl');
    enforceFreshContent();
    expect(localStorage.getItem('praxis_app_version')).toBe('2026.03.12.v4');
  });

  it('sets version when no stored version', async () => {
    const { enforceFreshContent } = await import('../../utils/versionControl');
    enforceFreshContent();
    expect(localStorage.getItem('praxis_app_version')).toBe('2026.03.12.v4');
  });
});

describe('nuclearReset', () => {
  it('clears localStorage and sessionStorage', async () => {
    localStorage.setItem('key', 'value');
    sessionStorage.setItem('key', 'value');
    const { nuclearReset } = await import('../../utils/versionControl');

    Object.defineProperty(globalThis, 'navigator', {
      value: { serviceWorker: undefined },
      writable: true,
    });
    Object.defineProperty(globalThis, 'caches', { value: undefined, writable: true });

    await nuclearReset();

    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('praxis_app_version')).toBe('2026.03.12.v4');
    expect(sessionStorage.length).toBe(0);
  });
});
