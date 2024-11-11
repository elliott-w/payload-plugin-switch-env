import { DatabaseAdapterObj, Endpoint, PayloadRequest } from 'payload'
import { statSync, utimesSync, writeFileSync } from 'node:fs'
import { getEnv, setEnv } from '../env'
import { backup } from '../mongo'
import { backupFile } from '../backupFile'

export interface SwitchEndpointInput {
  copyDatabase: boolean
}

export interface SwitchEndpointOutput {
  success: boolean
  message: string
}

export interface SwitchEndpointArgs {
  payloadConfigPath: string
}

export const switchEndpoint = ({ payloadConfigPath }: SwitchEndpointArgs): Endpoint => ({
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
    if (getEnv() === 'production') {
      setEnv('development')
      if (req.json) {
        const body = (await req.json()) as SwitchEndpointInput
        if (body.copyDatabase) {
          if ('connection' in req.payload.db) {
            const connection = req.payload.db.connection
            writeFileSync(backupFile, await backup(connection))
            // Delete models so that when payload's onInit calls db.onInit() it does not cause
            // Error: Cannot overwrite `users` model once compiled.
            Object.keys(connection.models).forEach((modelName) => {
              if (connection.models[modelName]) {
                connection.deleteModel(modelName)
              }
            })

            // Close the connection after cleaning up models
            await connection.close()

            // Log backup file
            const stats = statSync(backupFile)
            const formattedSize = formatFileSize(stats.size)
            logger.info(`Created production database backup file (${formattedSize}):`)
            logger.info(backupFile)
          } else {
            logger.warn('Could not create backup file for non-mongodb database')
          }
        }
      }
    } else {
      setEnv('production')
    }

    logger.info('Switched to ' + getEnv() + ' environment')

    // Delete cache of payload object
    ;(global as any)._payload.payload = null
    ;(global as any)._payload.promise = null
    // Trigger Hot-Module-Replacement of payload config
    // by updating the last accessed and last modified time of the file
    // (this does not trigger a file change in git)
    const time = new Date()
    utimesSync(payloadConfigPath, time, time)
    const res: SwitchEndpointOutput = {
      success: true,
      message: 'Switched to ' + getEnv(),
    }
    return Response.json(res)
  },
})

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}
