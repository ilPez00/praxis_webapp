/**
 * @vitest-environment jsdom
 */

import { isOffline, onOnlineStatusChange } from '../../utils/serviceWorker';

describe('isOffline', () => {
  it('returns true when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(isOffline()).toBe(true);
  });

  it('returns false when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    expect(isOffline()).toBe(false);
  });
});

describe('onOnlineStatusChange', () => {
  it('calls callback with true on online event', () => {
    const callback = vi.fn();
    onOnlineStatusChange(callback);
    window.dispatchEvent(new Event('online'));
    expect(callback).toHaveBeenCalledWith(true);
  });

  it('calls callback with false on offline event', () => {
    const callback = vi.fn();
    onOnlineStatusChange(callback);
    window.dispatchEvent(new Event('offline'));
    expect(callback).toHaveBeenCalledWith(false);
  });

  it('cleanup function removes event listeners', () => {
    const callback = vi.fn();
    const cleanup = onOnlineStatusChange(callback);
    cleanup();
    window.dispatchEvent(new Event('online'));
    expect(callback).not.toHaveBeenCalled();
  });
});
