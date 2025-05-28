import type { DatabaseAdapter, Endpoint, PayloadRequest } from 'payload'
import { getEnv, setEnv } from '../env'
import { backup, restore, type BackupData } from '../db/mongo'
import { formatFileSize } from '../utils'
import type { GetDatabaseAdapter } from '../db/getDbaFunction'
import { switchEnvironments } from '../collectionConfig'

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
}

export const switchEndpoint = ({
  getDatabaseAdapter,
  logDatabaseSize,
}: SwitchEndpointArgs): Endpoint => ({
  method: 'post',
  path: '/switch-env',
  handler: async (req: PayloadRequest) => {
    const logger = req.payload.logger
    const connection = req.payload.db.connection
    const env = getEnv()
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
    setEnv(newEnv)

    if (typeof req.payload.db.destroy === 'function') {
      await req.payload.db.destroy()
    }

    switchEnvironments(req.payload)

    const newDb = getDatabaseAdapter().init({ payload: req.payload })
    req.payload.db = newDb as unknown as DatabaseAdapter
    req.payload.db.payload = req.payload

    if (req.payload.db.init) {
      await req.payload.db.init()
    }

    if (req.payload.db.connect) {
      await req.payload.db.connect()
    }

    if (backupData) {
      logger.info('Restoring production database backup to local')
      await restore(req.payload.db.connection, backupData, req.payload.logger)
    }

    logger.info('Switched to ' + newEnv + ' environment')

    const res: SwitchEndpointOutput = {
      success: true,
      message: 'Switched to ' + newEnv,
    }
    return Response.json(res)
  },
})
