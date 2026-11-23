import { useTags } from '../hooks/useTags'
import { parseTags } from '../lib/tags'

interface Props {
  value: string
  onChange: (value: string) => void
}

/** A plain text box for tags ("travel, work") with the user's most-used
 * existing tags offered as one-tap chips underneath. */
export function TagInput({ value, onChange }: Props) {
  const { data: tags } = useTags()
  const current = parseTags(value)
  const suggestions = [...(tags ?? [])]
    .filter((t) => !current.includes(t.name))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  return (
    <div className="tag-input">
      <input
        className="pm-input"
        style={{ width: '100%' }}
        aria-label="Tags"
        placeholder="Tags, e.g. travel, work (optional)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {suggestions.length > 0 && (
        <div className="tag-suggestions">
          {suggestions.map((t) => (
            <button
              type="button"
              key={t.id}
              className="tag-chip tag-chip-btn"
              onClick={() => onChange([...current, t.name].join(', '))}
            >
              #{t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
