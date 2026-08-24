import { useEffect, useState } from 'react'
import AuthPage from './features/auth/AuthPage'
import LocationGate from './features/auth/LocationGate'
import { IconBird } from './components/icons'
import HomePage from './features/home/HomePage'
import { clearUser, storeUser, storedUser, type User } from './api/auth'
import { kvGet, kvSet } from './lib/blua-local'

const THEME_STORAGE_KEY = 'blue-atmosphere:theme'

function initialDarkMode() {
  return document.documentElement.classList.contains('dark')
}

function App() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [dark, setDark] = useState(initialDarkMode)
  const [foregroundAt, setForegroundAt] = useState(Date.now())

  // bootstrap : session + thème depuis IndexedDB (blua-local)
  useEffect(() => {
    Promise.all([storedUser(), kvGet<string>('pref:theme')]).then(([u, theme]) => {
      setUser(u)
      // IndexedDB est asynchrone. La valeur locale appliquée dans index.html
      // est la source de démarrage pour ne pas afficher brièvement le thème clair.
      setDark(theme ? theme === 'dark' : initialDarkMode())
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#060607' : '#e8f6ff')
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light')
    } catch {
      // Le thème IndexedDB reste disponible si le stockage synchrone est bloqué.
    }
    void kvSet('pref:theme', dark ? 'dark' : 'light')
  }, [dark, ready])

  useEffect(() => {
    const refreshForeground = () => {
      if (document.visibilityState === 'visible') setForegroundAt(Date.now())
    }
    document.addEventListener('visibilitychange', refreshForeground)
    return () => document.removeEventListener('visibilitychange', refreshForeground)
  }, [])

  function updateUser(nextUser: User) {
    setUser(nextUser)
    void storeUser(nextUser)
  }

  function toggleThemeAndReload() {
    const nextDark = !dark
    const theme = nextDark ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', nextDark)
    document.documentElement.style.colorScheme = theme
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', nextDark ? '#060607' : '#e8f6ff')
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // IndexedDB reste la source locale de secours.
    }
    void kvSet('pref:theme', theme).finally(() => window.location.reload())
  }

  async function logout() {
    await clearUser()
    setUser(null)
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-sky-soft dark:bg-night-0">
        <IconBird className="animate-bounce text-4xl text-accent" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage onAuth={updateUser} dark={dark} toggleDark={toggleThemeAndReload} />
  }

  if (!user.locationCheckedAt || foregroundAt - user.locationCheckedAt * 1000 >= 24 * 60 * 60 * 1000) {
    return <LocationGate user={user} onUpdated={updateUser} onLogout={logout} />
  }

  return (
    <HomePage
      user={user}
      dark={dark}
      toggleDark={toggleThemeAndReload}
      onLogout={logout}
      onUserUpdate={updateUser}
    />
  )
}

export default App
