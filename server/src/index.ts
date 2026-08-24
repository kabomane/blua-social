import express from 'express'
import { db } from './database/db.js'
import { authRouter } from './auth/routes.js'
import { deliveriesRouter } from './deliveries/routes.js'
import { messagesRouter } from './messages/routes.js'
import { branchesRouter } from './branches/routes.js'

// Point d'entrée de l'API Blue Atmosphere.
// Les routes métier (users, friendships, branches, messages, deliveries,
// pigeons, notifications) seront branchées ici au fur et à mesure.

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/deliveries', deliveriesRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/branches', branchesRouter)

app.get('/api/health', (_req, res) => {
  const row = db
    .prepare("SELECT COUNT(*) AS tables FROM sqlite_master WHERE type = 'table'")
    .get() as { tables: number }

  res.json({ status: 'ok', dbTables: row.tables })
})

app.listen(PORT, () => {
  console.log(`Blue Atmosphere API — http://localhost:${PORT}`)
})
