export function LogoMark({ size = 21 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#181a20"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h13a1.5 1.5 0 0 0 1.5-1.5V16" />
      <path d="M21 11.5h-6a2 2 0 0 0 0 4h6v-4Z" />
    </svg>
  )
}
