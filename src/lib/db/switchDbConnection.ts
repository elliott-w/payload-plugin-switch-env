import { type Payload, type DatabaseAdapter } from 'payload'
import type { Env } from '../../types'
import type { GetDatabaseAdapter } from './getDbaFunction'

export const switchDbConnection = async (
  payload: Payload,
  newEnv: Env,
  getDatabaseAdapter: GetDatabaseAdapter,
) => {
  payload.logger.debug(`Old database name: ${payload.db.connection.name}`)

  if (typeof payload.db.destroy === 'function') {
    await payload.db.destroy()
  }

  const newDb = getDatabaseAdapter(newEnv).init({ payload: payload })
  payload.db = newDb as unknown as DatabaseAdapter
  payload.db.payload = payload

  if (payload.db.init) {
    await payload.db.init()
  }

  if (payload.db.connect) {
    await payload.db.connect()
  }

  payload.logger.debug(`New database name: ${payload.db.connection.name}`)
}
