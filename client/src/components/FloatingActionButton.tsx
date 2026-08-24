import type { ReactNode } from 'react'

interface FloatingActionButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
}

export default function FloatingActionButton({
  label,
  onClick,
  children,
}: FloatingActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl text-white shadow-xl shadow-accent/40 transition active:scale-90 lg:hidden"
      style={{ bottom: 'calc(66px + max(12px, env(safe-area-inset-bottom)) + 14px)' }}
    >
      {children}
    </button>
  )
}
