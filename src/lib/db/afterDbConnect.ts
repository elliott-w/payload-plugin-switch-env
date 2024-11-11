import type { DatabaseAdapter, Payload } from 'payload'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { backupFile } from './backupFile.js'
import { restore } from './mongo.js'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { getEnv } from '../env.js'

export async function afterDbConnect({
  logger,
  db,
}: {
  logger: Payload['logger']
  db: DatabaseAdapter
}): Promise<void> {
  const env = getEnv()
  if (process.env.NODE_ENV === 'development' && env === 'development') {
    if (existsSync(backupFile)) {
      logger.info('Restoring production database backup file')
      const backupString = readFileSync(backupFile, 'utf8')
      unlinkSync(backupFile)
      await restore(db.connection, backupString, logger)
    }
  }
}
