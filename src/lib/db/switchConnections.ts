import type { BasePayload, DatabaseAdapter } from 'payload'
import { modifyUploadCollections } from '../collectionConfig'
import type { GetDatabaseAdapter } from './getDbaFunction'

export const switchDbConnections = async (
  payload: BasePayload,
  getDatabaseAdapter: GetDatabaseAdapter,
) => {
  if (typeof payload.db.destroy === 'function') {
    await payload.db.destroy()
  }

  modifyUploadCollections(payload)

  const newDb = getDatabaseAdapter().init({ payload: payload })
  payload.db = newDb as unknown as DatabaseAdapter
  payload.db.payload = payload

  if (payload.db.init) {
    await payload.db.init()
  }

  if (payload.db.connect) {
    await payload.db.connect()
  }
}
