export function getApiBase() {
  let apiBase = '';
  try {
    apiBase = import.meta?.env?.VITE_API_BASE_URL || '';
  } catch {
    // ignore - import.meta is undefined outside browser builds
  }
  if (!apiBase && typeof process !== 'undefined') {
    apiBase = process?.env?.VITE_API_BASE_URL || '';
  }
  if (!apiBase && typeof window !== 'undefined') {
    apiBase = window.__API_BASE_URL__ || (window.location?.origin || '');
  }
  if (!apiBase) {
    apiBase = 'https://profile-quest-puce.vercel.app';
  }
  return apiBase;
}
