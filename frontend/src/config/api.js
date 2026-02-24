const configuredApiBase = import.meta.env.VITE_API_BASE;

const apiBase = configuredApiBase && configuredApiBase.trim().length > 0
  ? configuredApiBase.trim()
  : '/api';

export const API_BASE = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
