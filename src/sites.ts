export interface SiteConfig {
  id: string;
  name: string;
}

/**
 * Each site is a completely independent copy of the app's data (employees, shift types,
 * schedules, preferences, audit log) - switching sites swaps out the entire dataset, so nothing
 * from one site can ever leak into or affect the other.
 */
export const SITES: SiteConfig[] = [
  { id: 'hagana-hasviva', name: 'הגנת הסביבה' },
  { id: 'sar-hachutz', name: 'שר החוץ' },
];

export const DEFAULT_SITE_ID = SITES[0].id;

export const CURRENT_SITE_STORAGE_KEY = 'shift-scheduler-current-site';
