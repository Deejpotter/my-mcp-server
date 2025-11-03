import { describe, it, expect, beforeEach } from 'vitest';
import { Cache, RateLimiter } from '../src/utils/cache.js';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache<string>(100); // 100ms TTL for faster tests
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should expire entries after TTL', async () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(cache.get('key1')).toBeUndefined();
  });

  it('should clear all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBeUndefined();
  });
});

describe('RateLimiter', () => {
  it('should allow calls within limit', () => {
    const limiter = new RateLimiter(3, 1000); // 3 calls per second
    
    expect(limiter.allowCall()).toBe(true);
    expect(limiter.allowCall()).toBe(true);
    expect(limiter.allowCall()).toBe(true);
  });

  it('should reject calls exceeding limit', () => {
    const limiter = new RateLimiter(2, 1000); // 2 calls per second
    
    limiter.allowCall(); // 1st call
    limiter.allowCall(); // 2nd call
    
    const result = limiter.allowCall(); // 3rd call should fail
    expect(result).toBe(false);
  });

  it('should reset after window expires', async () => {
    const limiter = new RateLimiter(2, 100); // 2 calls per 100ms
    
    limiter.allowCall();
    limiter.allowCall();
    
    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const result = limiter.allowCall();
    expect(result).toBe(true);
  });

  it('should return correct wait time', () => {
    const limiter = new RateLimiter(1, 1000);
    
    limiter.allowCall();
    const waitTime = limiter.getWaitTime();
    
    expect(waitTime).toBeGreaterThan(0);
    expect(waitTime).toBeLessThanOrEqual(1000);
  });
});
