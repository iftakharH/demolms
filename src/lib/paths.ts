import { APP_URL } from './env';

/** Absolute app URL used for links that leave the app (QR codes, copied links). */
export function appUrl(): string {
  return APP_URL;
}
