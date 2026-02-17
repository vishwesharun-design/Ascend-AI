/**
 * Device Fingerprinting Service
 * Generates a unique device identifier to prevent spam account creation
 */

/**
 * Generate a device fingerprint based on browser/device characteristics
 * This is a client-side fingerprint identifier
 */
export function generateDeviceFingerprint(): string {
  const components: string[] = [];

  // User agent
  components.push(navigator.userAgent);

  // Screen resolution
  components.push(`${window.screen.width}x${window.screen.height}`);

  // Color depth
  components.push(String(window.screen.colorDepth));

  // Timezone offset
  components.push(String(new Date().getTimezoneOffset()));

  // Language
  components.push(navigator.language);

  // Platform
  components.push(navigator.platform);

  // WebGL info if available
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Browser Fingerprint', 2, 15);
      components.push(canvas.toDataURL());
    }
  } catch (e) {
    components.push('no-canvas');
  }

  // Hardware concurrency
  if (navigator.hardwareConcurrency) {
    components.push(String(navigator.hardwareConcurrency));
  }

  // Create hash from components
  return btoa(components.join('|')).substring(0, 64);
}

/**
 * Get or create device fingerprint from localStorage
 */
export function getOrCreateDeviceFingerprint(): string {
  const STORAGE_KEY = 'acend_device_fingerprint';
  let fingerprint = localStorage.getItem(STORAGE_KEY);

  if (!fingerprint) {
    fingerprint = generateDeviceFingerprint();
    localStorage.setItem(STORAGE_KEY, fingerprint);
  }

  return fingerprint;
}

/**
 * Clear device fingerprint from storage
 */
export function clearDeviceFingerprint(): void {
  localStorage.removeItem('acend_device_fingerprint');
}
