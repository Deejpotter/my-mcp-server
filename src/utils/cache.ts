/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * Simple in-memory cache with TTL (time-to-live) support.
 * Used for caching API responses and expensive computations.
 * Implements rate limiting for external API calls.
 *
 * References:
 * Caching Strategies: https://aws.amazon.com/caching/
 */

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

/**
 * Simple in-memory cache with TTL
 */
export class Cache<T> {
	private cache: Map<string, CacheEntry<T>> = new Map();
	private defaultTTL: number;

	/**
	 * Create a new cache
	 * @param defaultTTL - Default time-to-live in milliseconds (default: 5 minutes)
	 */
	constructor(defaultTTL: number = 5 * 60 * 1000) {
		this.defaultTTL = defaultTTL;
	}

	/**
	 * Get a value from cache
	 * Returns undefined if not found or expired
	 */
	get(key: string): T | undefined {
		const entry = this.cache.get(key);

		if (!entry) {
			return undefined;
		}

		// Check if expired
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return undefined;
		}

		return entry.value;
	}

	/**
	 * Set a value in cache
	 * @param key - Cache key
	 * @param value - Value to cache
	 * @param ttl - Optional TTL in milliseconds (uses default if not provided)
	 */
	set(key: string, value: T, ttl?: number): void {
		const expiresAt = Date.now() + (ttl || this.defaultTTL);
		this.cache.set(key, { value, expiresAt });
	}

	/**
	 * Delete a value from cache
	 */
	delete(key: string): boolean {
		return this.cache.delete(key);
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Get cache size
	 */
	size(): number {
		return this.cache.size;
	}

	/**
	 * Clean up expired entries
	 */
	cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
			}
		}
	}
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
	private calls: number[] = [];
	private maxCalls: number;
	private windowMs: number;

	/**
	 * Create a rate limiter
	 * @param maxCalls - Maximum calls allowed in time window
	 * @param windowMs - Time window in milliseconds
	 */
	constructor(maxCalls: number, windowMs: number) {
		this.maxCalls = maxCalls;
		this.windowMs = windowMs;
	}

	/**
	 * Check if a call is allowed (within rate limit)
	 * If allowed, records the call timestamp
	 *
	 * @returns true if call is allowed, false if rate limit exceeded
	 */
	allowCall(): boolean {
		const now = Date.now();
		const windowStart = now - this.windowMs;

		// Remove calls outside the window
		this.calls = this.calls.filter((timestamp) => timestamp > windowStart);

		// Check if we can make another call
		if (this.calls.length >= this.maxCalls) {
			return false;
		}

		// Record this call
		this.calls.push(now);
		return true;
	}

	/**
	 * Get time until next call is allowed (in milliseconds)
	 * Returns 0 if a call is allowed now
	 */
	getWaitTime(): number {
		if (this.calls.length < this.maxCalls) {
			return 0;
		}

		const oldestCall = this.calls[0];
		if (!oldestCall) {
			return 0;
		}

		const nextAllowedTime = oldestCall + this.windowMs;
		const waitTime = nextAllowedTime - Date.now();

		return Math.max(0, waitTime);
	}

	/**
	 * Reset the rate limiter
	 */
	reset(): void {
		this.calls = [];
	}
}

// Global cache instances
export const apiCache = new Cache<any>(5 * 60 * 1000); // 5 minutes
export const documentationCache = new Cache<string>(30 * 60 * 1000); // 30 minutes

// Global rate limiters
export const githubLimiter = new RateLimiter(60, 60 * 1000); // 60 calls per minute
export const context7Limiter = new RateLimiter(100, 60 * 1000); // 100 calls per minute
export const genericLimiter = new RateLimiter(30, 60 * 1000); // 30 calls per minute
