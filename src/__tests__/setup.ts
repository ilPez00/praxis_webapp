// Jest test setup
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Mock console.error for cleaner test output
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0]?.includes('Jest') || args[0]?.includes('supertest')) {
    return;
  }
  originalConsoleError(...args);
};

// Global test timeout
jest.setTimeout(30000);

// Cleanup after all tests
afterAll(async () => {
  // Close any open database connections
  await new Promise(resolve => setTimeout(resolve, 1000));
});
