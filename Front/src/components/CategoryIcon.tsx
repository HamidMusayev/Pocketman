import { ICONS } from '../icons'

interface Props {
  iconKey: string
  size?: number
  strokeWidth?: number
}

/** Renders one of the ported SVG glyphs from `icons.ts` by key. Inherits color
 * from `currentColor`, matching the prototype's inline `stroke="currentColor"`. */
export function CategoryIcon({ iconKey, size = 18, strokeWidth = 1.7 }: Props) {
  const paths = ICONS[iconKey] ?? ICONS.other
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
