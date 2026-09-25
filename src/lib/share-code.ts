/** A shared set's code is the 10-character ending of its /s/ link. */
export const SHARE_CODE = /^[0-9A-Za-z]{10}$/;

/** Reads a code typed or pasted by a user: the bare code or a full share link. */
export function parseShareCode(input: string): string | null {
  const text = input.trim();
  if (SHARE_CODE.test(text)) return text;
  const fromLink = text.match(/\/s\/([0-9A-Za-z]{10})(?:[/?#]|$)/);
  return fromLink ? fromLink[1] : null;
}
