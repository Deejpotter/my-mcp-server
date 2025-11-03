import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, rmdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('File Operations', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `mcp-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should read and write files', async () => {
    const testFile = join(testDir, 'test.txt');
    const content = 'Hello, World!';
    
    await writeFile(testFile, content, 'utf-8');
    const result = await readFile(testFile, 'utf-8');
    
    expect(result).toBe(content);
  });

  it('should handle file not found', async () => {
    const nonexistent = join(testDir, 'nonexistent.txt');
    
    await expect(readFile(nonexistent, 'utf-8')).rejects.toThrow();
  });

  it('should create nested directories', async () => {
    const nestedDir = join(testDir, 'a', 'b', 'c');
    
    await mkdir(nestedDir, { recursive: true });
    
    // Should not throw
    expect(true).toBe(true);
  });
});
