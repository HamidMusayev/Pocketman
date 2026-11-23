/** Same rules as the backend: "#Travel" and "travel" are one tag, spaces inside
 * a tag become "-", and tags are separated by commas or spaces. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-')
}

export function parseTags(text: string): string[] {
  const out: string[] = []
  for (const part of text.split(/[,\s]+/)) {
    const tag = normalizeTag(part)
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out
}

export function formatTags(tags: string[]): string {
  return tags.join(', ')
}

export const TAG_PATTERN = /^[\p{L}\p{N}_-]+$/u
export const MAX_TAG_LEN = 40
export const MAX_TAGS = 10

/** An error message for the tag box, or null when it's fine. */
export function tagsError(tags: string[]): string | null {
  if (tags.length > MAX_TAGS) return `Use at most ${MAX_TAGS} tags.`
  const bad = tags.find((t) => !TAG_PATTERN.test(t))
  if (bad) return `"${bad}": tags can only use letters, digits, - and _.`
  const long = tags.find((t) => t.length > MAX_TAG_LEN)
  if (long) return `Tags can be at most ${MAX_TAG_LEN} characters.`
  return null
}
