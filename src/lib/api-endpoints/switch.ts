import type { Endpoint, PayloadRequest } from 'payload'
import type { GetDatabaseAdapter } from '../db/getDbaFunction'
import { backup, restore } from '../db/mongo'
import { switchDbConnections } from '../db/switchConnections'
import { getEnv, setEnv } from '../env'
import { formatFileSize } from '../utils'

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

    await switchDbConnections(req.payload, getDatabaseAdapter)

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
