// URL of the deployed Google Apps Script Web App (ends with /exec).
// It is not a secret: the browser has to call it anyway. Every request is
// protected by the team password that only the Apps Script knows.
// VITE_API_URL (e.g. in .env.local) overrides it for local testing.
const DEPLOYED_API_URL = "";

export const API_URL = import.meta.env.VITE_API_URL || DEPLOYED_API_URL;
