import type { Endpoint, PayloadRequest } from 'payload'
import { backup, restore, type BackupData } from '../db/mongo'
import { formatFileSize, getServerUrl } from '../utils'
import type { GetDatabaseAdapter } from '../db/getDbaFunction'
import { switchEnvironments } from '../collectionConfig'
import type { GetEnv, SetEnv } from '../../types'
import { switchDbConnection } from '../db/switchDbConnection'

export interface SwitchEndpointInput {
  copyDatabase: boolean
}

export interface SwitchEndpointOutput {
  success: boolean
  message: string
}

export interface SwitchEndpointArgs {
  getDatabaseAdapter: GetDatabaseAdapter
  logDatabaseSize: boolean
  getEnv: GetEnv
  setEnv: SetEnv
}

export const switchEndpoint = ({
  getDatabaseAdapter,
  logDatabaseSize,
  getEnv,
  setEnv,
}: SwitchEndpointArgs): Endpoint => ({
  method: 'post',
  path: '/switch-env',
  handler: async (req: PayloadRequest) => {
    const logger = req.payload.logger
    const connection = req.payload.db.connection
    const env = await getEnv(req.payload)
    let backupData: BackupData | null = null
    if (env === 'production') {
      if (req.json) {
        const body = (await req.json()) as SwitchEndpointInput
        if (body.copyDatabase) {
          backupData = await backup(connection)
          const databaseSize = logDatabaseSize
            ? formatFileSize(JSON.stringify(backupData).length)
            : null
          logger.info(
            `Created backup of production database${databaseSize ? ` (${databaseSize})` : ''}`,
          )
        }
      }
    }

    const newEnv = env === 'production' ? 'development' : 'production'

    await setEnv(newEnv, req.payload)

    await switchDbConnection(req.payload, newEnv, getDatabaseAdapter)

    if (backupData) {
      logger.info('Restoring production database backup to local')
      await restore(req.payload.db.connection, backupData, req.payload.logger)
    }

    await setEnv(newEnv, req.payload)

    const serverUrl = getServerUrl(req)
    const isDev = process.env.NODE_ENV === 'development'

    if (!isDev) {
      await fetch(
        `${serverUrl}/admin/switch-db-connection?env=${newEnv}&secret=${req.payload.config.secret}`,
      )
    }

    switchEnvironments(req.payload, newEnv)

    logger.info('Switched to ' + newEnv + ' environment')

    const res: SwitchEndpointOutput = {
      success: true,
      message: 'Switched to ' + newEnv,
    }
    return Response.json(res)
  },
})
