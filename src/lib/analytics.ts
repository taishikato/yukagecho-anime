import posthog from 'posthog-js/dist/module.no-external';

// Auth callbacks can contain credentials in the URL, including initial URL properties.
export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => {
      if (typeof value === 'string' && /^https?:\/\//.test(value)) {
        try {
          const url = new URL(value);
          value = `${url.origin}${url.pathname}`;
        } catch {
          value = '';
        }
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        value = sanitizeAnalyticsProperties(value as Record<string, unknown>);
      }
      return [key, value];
    }),
  );
}

const key = import.meta.env.VITE_POSTHOG_KEY;
const enabled = import.meta.env.PROD && typeof key === 'string' && key.startsWith('phc_');

export function initAnalytics() {
  if (!enabled) return;
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-05-30',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    autocapture: false,
    person_profiles: 'never',
    disable_session_recording: true,
    disable_surveys: true,
    before_send: (event) => {
      if (event) event.properties = sanitizeAnalyticsProperties(event.properties);
      return event;
    },
  });
}

type AnalyticsEvent = 'place_explored' | 'registration_opened' | 'photo_saved' | 'time_changed';

export function captureEvent(event: AnalyticsEvent, properties?: Record<string, string | boolean>) {
  if (enabled) posthog.capture(event, properties);
}
