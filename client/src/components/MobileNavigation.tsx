import { useEffect, useRef, type ComponentType, type CSSProperties, type SVGProps } from 'react'
import { IconHome, IconMenu } from './icons'

export type MobileMenuStyle = 'bubbles' | 'sheet'

export interface MobileNavDestination {
  route: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  kind?: 'bookmarks'
}

interface MobileNavigationProps {
  currentRoute: string
  bookmarkCount: number
  shortcuts: readonly [MobileNavDestination, MobileNavDestination]
  menuItems: readonly MobileNavDestination[]
  onNavigate: (route: string) => void
  onOpenMenu: () => void
  menuOpen?: boolean
  menuStyle?: MobileMenuStyle
}

const HOME: MobileNavDestination = {
  route: '/home',
  label: 'Home',
  icon: IconHome,
}

export default function MobileNavigation({
  currentRoute,
  bookmarkCount,
  shortcuts,
  menuItems,
  onNavigate,
  onOpenMenu,
  menuOpen = false,
  menuStyle = 'bubbles',
}: MobileNavigationProps) {
  const actions = [HOME, ...shortcuts]
  const availableMenuItems = menuItems.filter(
    (item) =>
      item.route !== currentRoute && !actions.some((action) => action.route === item.route),
  )
  const navigationRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!navigationRef.current?.contains(event.target as Node)) onOpenMenu()
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenMenu()
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen, onOpenMenu])

  return (
    <nav
      ref={navigationRef}
      aria-label="Navigation principale"
      className="fixed right-3 left-3 z-50 mx-auto grid min-h-nav-bar max-w-[420px] grid-cols-4 overflow-visible rounded-2xl border border-white/70 bg-white/92 shadow-floating-nav backdrop-blur-xl lg:hidden dark:border-night-line dark:bg-night-1/94 dark:shadow-floating-nav-dark"
      style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      {menuOpen && menuStyle === 'bubbles' && (
        <div
          aria-label="Menu principal"
          className="pointer-events-none absolute right-0 bottom-[calc(100%+12px)] flex w-[min(260px,calc(100vw-24px))] flex-col-reverse gap-2"
        >
          {availableMenuItems.map((item, index) => {
            const active = currentRoute === item.route
            const Icon = item.icon
            const badge = item.kind === 'bookmarks' ? bookmarkCount : 0

            return (
              <button
                key={item.route}
                type="button"
                onClick={() => onNavigate(item.route)}
                className={
                  'mobile-menu-bubble pointer-events-auto ml-auto flex h-menu-bubble w-full origin-right items-center gap-3 rounded-full border px-4 text-left text-label font-bold shadow-menu backdrop-blur-xl transition active:scale-95 dark:border-night-line ' +
                  (active
                    ? 'border-white/80 bg-sky-50/95 text-accent dark:bg-accent/15 dark:text-accent-soft'
                    : 'border-white/70 bg-white/94 text-ink dark:bg-night-1/95 dark:text-zinc-100')
                }
                style={{ '--bubble-delay': `${index * 90}ms` } as CSSProperties}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xl text-accent dark:bg-accent/15 dark:text-accent-soft">
                  <Icon />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {!!badge && badge > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            )
            })}
        </div>
      )}
      {menuOpen && menuStyle === 'sheet' && (
        <section
          aria-label="Menu principal"
          className="mobile-menu-sheet absolute right-0 bottom-[calc(100%+12px)] left-0 rounded-sheet border border-white/70 bg-white/96 p-3 pt-2 shadow-sheet backdrop-blur-xl dark:border-night-line dark:bg-night-1/98 dark:shadow-sheet-dark"
        >
          <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-slate-300 dark:bg-zinc-700" />
          <div className="grid grid-cols-3 gap-2">
            {availableMenuItems.map((item) => {
              const Icon = item.icon
              const badge = item.kind === 'bookmarks' ? bookmarkCount : 0

              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => onNavigate(item.route)}
                  className="flex min-h-menu-cell min-w-0 flex-col items-center justify-center gap-2 rounded-2xl px-2 py-3 text-center text-nav font-bold text-ink transition hover:bg-sky-50 active:scale-95 dark:text-zinc-100 dark:hover:bg-night-2"
                >
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-2xl text-accent dark:bg-accent/15 dark:text-accent-soft">
                    <Icon />
                    {!!badge && badge > 0 && (
                      <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-micro leading-none font-extrabold text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}
      {actions.map((action, index) => {
        const active = !menuOpen && currentRoute === action.route
        const Icon = action.icon
        const showBookmarkBadge = action.kind === 'bookmarks' && bookmarkCount > 0

        return (
          <button
            key={`${index}-${action.route}`}
            type="button"
            aria-current={active ? 'page' : undefined}
            aria-label={
              showBookmarkBadge
                ? `${action.label}, ${bookmarkCount} signet${bookmarkCount > 1 ? 's' : ''}`
                : action.label
            }
            onClick={() => onNavigate(action.route)}
            className={
              'relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-micro font-bold transition active:scale-95 ' +
              (active
                ? 'text-accent dark:text-accent-soft'
                : 'text-ink-muted hover:bg-sky-50/60 dark:text-zinc-500 dark:hover:bg-night-2')
            }
          >
            <span className="relative">
              <Icon className="text-2xl" />
              {showBookmarkBadge && (
                <span className="absolute -top-2 -right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-micro leading-none font-extrabold text-white">
                  {bookmarkCount > 99 ? '99+' : bookmarkCount}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{action.label}</span>
          </button>
        )
      })}
      <button
        type="button"
        aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={menuOpen}
        onClick={onOpenMenu}
        className={
          'relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-micro font-bold transition active:scale-95 ' +
          (menuOpen
            ? 'text-accent dark:text-accent-soft'
            : 'text-ink-muted hover:bg-sky-50/60 dark:text-zinc-500 dark:hover:bg-night-2')
        }
      >
        <IconMenu className="text-2xl" />
        <span>Menu</span>
      </button>
    </nav>
  )
}
