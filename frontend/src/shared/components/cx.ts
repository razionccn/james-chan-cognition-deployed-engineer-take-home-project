/** Tiny className joiner (avoids pulling in clsx for one helper). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
