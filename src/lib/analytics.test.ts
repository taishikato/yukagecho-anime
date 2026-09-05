import { describe, expect, it, vi } from 'vitest';
import { sanitizeAnalyticsProperties } from './analytics';

vi.mock('posthog-js/dist/module.no-external', () => ({
  default: { init: vi.fn(), capture: vi.fn() },
}));

describe('analytics URL privacy', () => {
  it('removes authentication credentials from current and initial URLs', () => {
    const input = {
      $current_url: 'https://anime.yukagecho.workers.dev/?code=secret#access_token=secret',
      $referrer: 'https://example.com/path?email=private@example.com',
      $set_once: {
        $initial_current_url: 'https://anime.yukagecho.workers.dev/#refresh_token=secret',
      },
      place_id: 'shrine',
      night: true,
    };
    expect(sanitizeAnalyticsProperties(input)).toEqual({
      $current_url: 'https://anime.yukagecho.workers.dev/',
      $referrer: 'https://example.com/path',
      $set_once: { $initial_current_url: 'https://anime.yukagecho.workers.dev/' },
      place_id: 'shrine',
      night: true,
    });
    expect(input.$current_url).toContain('secret');
  });
});
