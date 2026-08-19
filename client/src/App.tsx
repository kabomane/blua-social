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

  async function logout() {
    await clearUser()
    setUser(null)
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-night-0">
        <IconBird className="animate-bounce text-4xl text-accent" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage onAuth={updateUser} dark={dark} toggleDark={() => setDark(!dark)} />
  }

  if (!user.locationCheckedAt || foregroundAt - user.locationCheckedAt * 1000 >= 24 * 60 * 60 * 1000) {
    return <LocationGate user={user} onUpdated={updateUser} onLogout={logout} />
  }

  return (
    <HomePage
      user={user}
      dark={dark}
      toggleDark={() => setDark(!dark)}
      onLogout={logout}
      onUserUpdate={updateUser}
    />
  )
}

export default App
