# Testing Guide

## Overview

This project uses **Vitest** for unit testing. Tests are located in the `tests/` directory and cover core utilities and functionality.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage
npx vitest run --coverage
```

## Test Structure

### Current Test Coverage

- ✅ **Security Validation** (`tests/security.test.ts`)
  - Path validation (forbidden paths, directory traversal)
  - Command validation (allowlist, dangerous patterns)
  - Security configuration retrieval

- ✅ **Cache & Rate Limiting** (`tests/cache.test.ts`)
  - TTL-based caching (set, get, clear, expiry)
  - Rate limiting (allowCall, window expiry, wait time)

- ✅ **File Operations** (`tests/fileTools.test.ts`)
  - Read/write file operations
  - Error handling for missing files
  - Nested directory creation

### Writing New Tests

1. Create a new file in `tests/` with the pattern `*.test.ts`
2. Import test functions from Vitest:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from 'vitest';
   ```

3. Import the code you want to test from `../src/`
4. Write descriptive test cases

Example:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/utils/myModule.js';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

## Configuration

- `vitest.config.ts` - Vitest configuration
- Test files use ESM imports (`.js` extensions required)
- Coverage reports generated in `coverage/` directory

## Best Practices

1. **Test behavior, not implementation** - Focus on inputs/outputs
2. **Use descriptive test names** - Should read like documentation
3. **Keep tests isolated** - Use `beforeEach`/`afterEach` for setup/cleanup
4. **Test edge cases** - Error conditions, boundaries, empty inputs
5. **Fast tests** - Use shorter TTLs for time-based tests (e.g., 100ms instead of 5min)

## CI/CD Integration

Tests can be run in CI pipelines:

```bash
npm test
```

Exit code 0 = all tests pass
Exit code 1 = test failures
