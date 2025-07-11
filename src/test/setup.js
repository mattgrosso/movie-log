// Test setup file for Vitest
// This file is run before all tests

// Global test configuration
import { vi } from 'vitest'

// Mock window.scroll for JSDOM compatibility
Object.defineProperty(window, 'scroll', {
  value: vi.fn(),
  writable: true
})

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Suppress console logs during tests unless explicitly needed
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}

// Global test utilities
global.testUtils = {
  // Helper to restore console for debugging specific tests
  enableConsole: () => {
    global.console.log = console.log
    global.console.warn = console.warn
    global.console.error = console.error
    global.console.info = console.info
  }
}