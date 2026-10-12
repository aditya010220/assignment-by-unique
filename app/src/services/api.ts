import { Lead } from '../types/lead';

let currentServerUrl =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SERVER_URL) ||
  (typeof window !== 'undefined' && window.location?.hostname
    ? `http://${window.location.hostname}:3000`
    : 'http://192.168.1.6:3000');

export function getServerUrl(): string {
  return currentServerUrl;
}

export function setServerUrl(url: string): void {
  currentServerUrl = url;
}

/**
 * Fetches leads from the server REST endpoint.
 * @param since Optional ISO timestamp string to fetch only newer leads
 */
export async function fetchLeads(since?: string): Promise<Lead[]> {
  const base = getServerUrl().replace(/\/$/, '');
  const url = since ? `${base}/leads?since=${encodeURIComponent(since)}` : `${base}/leads`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leads: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
