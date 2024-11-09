import type { Payload } from 'payload'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { backupFile } from './backupFile.js'
import { restore } from './mongo.js'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'

export const onInitExtension = async (payload: Payload): Promise<void> => {
  const logger = payload.logger
  if (existsSync(backupFile)) {
    logger.info('Restoring production database backup file')
    const backupString = readFileSync(backupFile, 'utf8')
    unlinkSync(backupFile)
    await restore(payload.db.connection, backupString, logger)
  }
}
