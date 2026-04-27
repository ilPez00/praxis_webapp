import { cacheGet, cacheSet, cacheDelete, TTL } from '../../utils/cache';

describe('cache', () => {
  beforeEach(() => {
    cacheDelete(''); // clear all
  });

  it('returns undefined for missing key', () => {
    expect(cacheGet('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves a value', () => {
    cacheSet('key1', { data: 42 }, 60);
    expect(cacheGet('key1')).toEqual({ data: 42 });
  });

  it('returns undefined after TTL expires', async () => {
    cacheSet('key2', 'value', 0); // 0 second TTL
    await new Promise(r => setTimeout(r, 10));
    expect(cacheGet('key2')).toBeUndefined();
  });

  it('deletes a single key by exact match', () => {
    cacheSet('alpha', 1, 60);
    cacheSet('beta', 2, 60);
    cacheDelete('alpha');
    expect(cacheGet('alpha')).toBeUndefined();
    expect(cacheGet('beta')).toBe(2);
  });

  it('deletes all keys by prefix pattern', () => {
    cacheSet('user:1', 'a', 60);
    cacheSet('user:2', 'b', 60);
    cacheSet('other:1', 'c', 60);
    cacheDelete('user:');
    expect(cacheGet('user:1')).toBeUndefined();
    expect(cacheGet('user:2')).toBeUndefined();
    expect(cacheGet('other:1')).toBe('c');
  });

  it('stores strings, numbers, objects, and arrays', () => {
    cacheSet('str', 'hello', 60);
    cacheSet('num', 99, 60);
    cacheSet('obj', { a: 1, b: [2, 3] }, 60);
    cacheSet('arr', [1, 'two', false], 60);
    expect(cacheGet('str')).toBe('hello');
    expect(cacheGet('num')).toBe(99);
    expect(cacheGet('obj')).toEqual({ a: 1, b: [2, 3] });
    expect(cacheGet('arr')).toEqual([1, 'two', false]);
  });

  it('TTL presets have expected values', () => {
    expect(TTL.SHORT).toBe(300);
    expect(TTL.MEDIUM).toBe(900);
    expect(TTL.LONG).toBe(3600);
  });

  it('overwrites existing key', () => {
    cacheSet('key', 'old', 60);
    cacheSet('key', 'new', 60);
    expect(cacheGet('key')).toBe('new');
  });
});
