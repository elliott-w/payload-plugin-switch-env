import type { DatabaseAdapter, Endpoint, PayloadRequest } from 'payload'
import { getEnv, setEnv } from '../env'
import { backup, restore } from '../db/mongo'
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
}

export const switchEndpoint = ({ getDatabaseAdapter }: SwitchEndpointArgs): Endpoint => ({
  method: 'post',
  path: '/switch-env',
  handler: async (req: PayloadRequest) => {
    const logger = req.payload.logger
    const connection = req.payload.db.connection
    const env = getEnv()
    let backupString: string | null = null
    if (env === 'production') {
      if (req.json) {
        const body = (await req.json()) as SwitchEndpointInput
        if (body.copyDatabase) {
          backupString = await backup(connection)
          const formattedSize = formatFileSize(Buffer.byteLength(backupString, 'utf-8'))
          logger.info(`Created backup of production database (${formattedSize})`)
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

    if (backupString) {
      logger.info('Restoring production database backup to local')
      await restore(req.payload.db.connection, backupString, req.payload.logger)
    }

    logger.info('Switched to ' + newEnv + ' environment')

    const res: SwitchEndpointOutput = {
      success: true,
      message: 'Switched to ' + newEnv,
    }
    return Response.json(res)
  },
})
