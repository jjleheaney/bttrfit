/**
 * A JWT minted a fraction of a second ago can reach PostgREST before its own
 * `iat` has passed there, and PostgREST rejects it outright with PGRST303
 * "JWT issued at future". The token is valid; the two services simply disagree
 * about the current second.
 *
 * It surfaces exactly where it hurts most, because the request that follows a
 * freshly minted token is the first page render after signing up or changing a
 * password — so a working app greets a brand new user with an error screen.
 * Waiting out the skew and repeating the same request fixes it: the rejected
 * attempt never reached the tables, so a write is as safe to repeat as a read.
 */
export const CLOCK_SKEW_RETRY_MS = 750;

const CLOCK_SKEW_CODE = "PGRST303";

export function withClockSkewRetry(
  inner: typeof fetch,
  delayMs = CLOCK_SKEW_RETRY_MS,
): typeof fetch {
  return async (input, init) => {
    const response = await inner(input, init);
    if (response.ok) return response;

    // `clone()` rather than `text()`: the original body must stay unread for
    // whoever asked for it, error or not.
    const body = await response
      .clone()
      .text()
      .catch(() => "");
    if (!body.includes(CLOCK_SKEW_CODE)) return response;

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return inner(input, init);
  };
}
