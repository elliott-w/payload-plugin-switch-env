import { DatabaseAdapter, Endpoint, PayloadRequest } from 'payload'
import { statSync, utimesSync, writeFileSync } from 'node:fs'
import { getEnv, setEnv } from '../env'
import { backup } from '../db/mongo'
import { backupFile } from '../db/backupFile'
import { formatFileSize } from '../utils'
import { type GetDatabaseAdapter } from '../db/getDbaFunction'

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
  path: '/switch',
  handler: async (req: PayloadRequest) => {
    const logger = req.payload.logger
    if (process.env.NODE_ENV === 'production') {
      return Response.json({
        success: false,
        message: 'This endpoint is only available in development mode',
      })
    }
    const connection = req.payload.db.connection
    const currentEnv = getEnv()
    if (currentEnv === 'production') {
      if (req.json) {
        const body = (await req.json()) as SwitchEndpointInput
        if (body.copyDatabase) {
          writeFileSync(backupFile, await backup(connection))
          const stats = statSync(backupFile)
          const formattedSize = formatFileSize(stats.size)
          logger.info(`Created production database backup file (${formattedSize}):`)
          logger.info(backupFile)
        }
      }
    }

    const newEnv = currentEnv === 'production' ? 'development' : 'production'
    setEnv(newEnv)

    if (typeof req.payload.db.destroy === 'function') {
      await req.payload.db.destroy()
    }

    const newDb = getDatabaseAdapter().init({ payload: req.payload })
    req.payload.db = newDb as unknown as DatabaseAdapter
    req.payload.db.payload = req.payload

    if (req.payload.db.init) {
      await req.payload.db.init()
    }

    if (req.payload.db.connect) {
      await req.payload.db.connect()
    }

    logger.info('Switched to ' + newEnv + ' environment')

    const res: SwitchEndpointOutput = {
      success: true,
      message: 'Switched to ' + newEnv,
    }
    return Response.json(res)
  },
})
