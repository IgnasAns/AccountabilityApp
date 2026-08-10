/**
 * Client-side image type allowlist (M9).
 *
 * Photo proof and avatar uploads must never accept anything but images.
 * expo-image-picker's `mediaTypes: Images` already narrows the picker, but a
 * URI arriving from any other path (deep link, web paste, future feature)
 * still needs a defensive check before it is uploaded to Supabase Storage.
 */

const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

const ALLOWED_IMAGE_MIME_PREFIXES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
];

/**
 * True when the URI points at one of the allowed image types:
 * jpeg/png/webp/heic. Handles `data:image/...` URLs (web) and
 * `file://`/`content://` URIs by extension.
 */
export function isAllowedImageUri(uri: string | null | undefined): boolean {
    if (!uri) return false;
    const lower = uri.toLowerCase();

    // data:image/jpeg;base64,... — trust the declared mime type.
    if (lower.startsWith('data:image/')) {
        const end = lower.indexOf(';');
        const mime = end > 0 ? lower.slice(0, end) : lower;
        return ALLOWED_IMAGE_MIME_PREFIXES.some((allowed) => mime.startsWith(allowed));
    }

    // Strip query/hash (signed storage URLs) and read the extension.
    const clean = lower.split('?')[0].split('#')[0];
    const dot = clean.lastIndexOf('.');
    if (dot < 0) return false;
    const ext = clean.slice(dot + 1);
    return ALLOWED_IMAGE_EXTENSIONS.includes(ext);
}
