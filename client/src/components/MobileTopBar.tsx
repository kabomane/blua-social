import { IconBird, IconMail } from './icons'

interface MobileTopBarProps {
  title?: string
  backLabel?: string
  onBack?: () => void
  pigeonsFree: number
  stamps: number
  mobileOnly?: boolean
}

export default function MobileTopBar({
  title,
  backLabel,
  onBack,
  pigeonsFree,
  stamps,
  mobileOnly = false,
}: MobileTopBarProps) {
  return (
    <header
      className={
        'sticky top-0 z-30 border-b border-white/50 bg-white/80 backdrop-blur dark:border-night-line dark:bg-night-0/85 ' +
        (mobileOnly ? 'lg:hidden' : '')
      }
    >
      <div className="mx-auto flex min-h-12 max-w-[720px] items-center gap-3 px-4">
        {onBack ? (
          <>
            <button
              type="button"
              onClick={onBack}
              aria-label={`Retour vers ${backLabel ?? 'la page précédente'}`}
              className="flex min-h-11 shrink-0 items-center rounded-full text-title font-bold text-ink-muted hover:text-ink dark:text-zinc-500 dark:hover:text-zinc-100"
            >
              ← {!title && backLabel}
            </button>
            {title && <h1 className="min-w-0 truncate text-title font-extrabold">{title}</h1>}
          </>
        ) : (
          <>
            <IconBird className="text-xl text-accent" />
            <h1 className="text-title font-extrabold">{title}</h1>
          </>
        )}

        <div className="ml-auto flex items-center gap-3 text-meta font-bold text-ink-muted dark:text-zinc-500">
          <span className="flex items-center gap-1" title="Pigeons disponibles">
            <IconBird className="text-base" /> {pigeonsFree}
          </span>
          <span className="flex items-center gap-1" title="Lettres disponibles">
            <IconMail className="text-base" /> {stamps}
          </span>
        </div>
      </div>
    </header>
  )
}
