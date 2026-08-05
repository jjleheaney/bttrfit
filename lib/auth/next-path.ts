/**
 * `next` arrives from query strings and form fields, so it is attacker
 * controlled. Anything that is not a plain same-origin path is discarded:
 * "//evil.example" and "https://evil.example" are both absolute URLs to a
 * browser, and a backslash is treated as a slash by some of them.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) {
    return "/";
  }
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return "/";
  }
  return value;
}
