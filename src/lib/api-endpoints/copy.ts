import type { DatabaseAdapter, Endpoint, PayloadRequest } from 'payload'
import { backup, restore, type BackupData } from '../db/mongo'
import { formatFileSize } from '../utils'
import type { GetDatabaseAdapter } from '../db/getDbaFunction'
import type { GetEnv } from '../../types'
import { switchDbConnection } from '../db/switchDbConnection'
import {
  resolveVersionCollectionModes,
  type CollectionVersionsOverrides,
  type GlobalVersionsOverrides,
} from '../copyVersions'
import type { CopyVersionsModes } from '../../types'

export interface CopyEndpointInput {
  // No parameters needed - always copies from production to development
}

export interface CopyEndpointOutput {
  success: boolean
  message: string
}

export interface CopyEndpointArgs {
  getDatabaseAdapter: GetDatabaseAdapter
  logDatabaseSize: boolean
  getEnv: GetEnv
  versions: CopyVersionsModes
  collections?: CollectionVersionsOverrides
  globals?: GlobalVersionsOverrides
}

export const copyEndpoint = ({
  getDatabaseAdapter,
  logDatabaseSize,
  getEnv,
  versions,
  collections,
  globals,
}: CopyEndpointArgs): Endpoint => ({
  method: 'post',
  path: '/copy-db',
  handler: async (req: PayloadRequest) => {
    const payload = req.payload
    const logger = payload.logger
    const currentEnv = await getEnv(payload)

    if (currentEnv !== 'development') {
      return Response.json({
        success: false,
        message: 'This endpoint can only be used from development environment',
      } as CopyEndpointOutput)
    }

    try {
      logger.debug(`Switching db connection to production environment`)
      await switchDbConnection(payload, 'production', getDatabaseAdapter)

      logger.debug(`Creating backup from production environment`)
      const versionCollectionModes = resolveVersionCollectionModes({
        payload,
        defaultVersions: versions,
        collectionOverrides: collections,
        globalOverrides: globals,
      })
      const backupData = await backup(payload.db.connection, {
        versionCollectionModes,
      })

      const databaseSize = logDatabaseSize
        ? formatFileSize(JSON.stringify(backupData).length)
        : null

      logger.info(
        `Created backup from production database${databaseSize ? ` (${databaseSize})` : ''}`,
      )

      logger.debug(`Switching db connection to development environment`)
      await switchDbConnection(payload, 'development', getDatabaseAdapter)

      logger.debug(`Restoring production database backup to development environment`)
      await restore(payload.db.connection, backupData, logger)

      logger.info(`Successfully copied production database to development environment`)

      const res: CopyEndpointOutput = {
        success: true,
        message: `Successfully copied production database to development`,
      }
      return Response.json(res)
    } catch (error) {
      logger.error(error, `Failed to copy database from production to development`)
      return Response.json({
        success: false,
        message: `Failed to copy database: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      } as CopyEndpointOutput)
    }
  },
})
