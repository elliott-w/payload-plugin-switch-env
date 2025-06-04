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
    const payload = req.payload
    const logger = payload.logger
    const connection = payload.db.connection
    const env = await getEnv(payload)
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

    if (env === 'development') {
      await setEnv(newEnv, payload)
    }

    await switchDbConnection(payload, newEnv, getDatabaseAdapter)

    if (backupData) {
      logger.info('Restoring production database backup to local')
      await restore(payload.db.connection, backupData, payload.logger)
    }

    if (newEnv === 'development') {
      await setEnv(newEnv, payload)
    }

    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev) {
      const serverUrl = getServerUrl(req)
      const adminRoute = payload.config.routes.admin
      const searchParams = new URLSearchParams()
      searchParams.set('env', newEnv)
      searchParams.set('secret', payload.config.secret)
      const queryString = searchParams.toString()
      await fetch(`${serverUrl}${adminRoute}/switch-db-connection?${queryString}`)
    }

    switchEnvironments(payload, newEnv)

    logger.info('Switched to ' + newEnv + ' environment')

    const res: SwitchEndpointOutput = {
      success: true,
      message: 'Switched to ' + newEnv,
    }
    return Response.json(res)
  },
})
