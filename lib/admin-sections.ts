/**
 * Shared by the client nav and the server section page. Kept out of the
 * 'use client' file: importing a plain value from a client module into a
 * server component yields a client-reference proxy, not the array itself.
 */
export const SECTIONS = [
  { key: 'stays', label: '🏨 Accommodation' },
  { key: 'days', label: '📅 Days' },
  { key: 'travel', label: '🚆 Travel' },
  { key: 'map', label: '🗺️ Map places' },
  { key: 'details', label: '📝 Details & notes' },
  { key: 'manage', label: '⚙️ Duplicate / delete' },
] as const;

export type SectionKey = (typeof SECTIONS)[number]['key'];
