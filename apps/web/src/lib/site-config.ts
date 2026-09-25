/**
 * Public site details used by the legal pages.
 *
 * TODO(owner): set NEXT_PUBLIC_CONTACT_EMAIL (Vercel env) to a real, monitored
 * address before publishing — the Chrome Web Store requires a working
 * contact for privacy requests. Also review the legal text in
 * src/app/privacy and src/app/terms.
 */
export const SITE_NAME = "Job Jet";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "[contact email — to be added]";
export const LEGAL_LAST_UPDATED = "September 25, 2026";
