import { execSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

/** Reads the local stack's public settings so no keys live in the repo. */
function localSupabaseEnv(): Record<string, string> {
  if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    return {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  }
  const status = JSON.parse(
    execSync('npx supabase status -o json', { encoding: 'utf8' }),
  ) as Record<string, string>;
  return {
    VITE_SUPABASE_URL: status.API_URL ?? '',
    VITE_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY ?? '',
  };
}

const PORT = 4173;

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  outputDir: '../test-results',
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: '../playwright-report' }]]
    : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    cwd: '..', // relative to this file: build and serve from the repo root
    reuseExistingServer: !process.env.CI,
    env: { ...(process.env as Record<string, string>), ...localSupabaseEnv() },
    stdout: 'pipe',
    timeout: 120_000,
  },
});
