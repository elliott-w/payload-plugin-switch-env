// This import is required for the connection object to be typed on the payload.db object
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import type { Config, Plugin } from 'payload'
import { switchEndpoint } from './lib/api-endpoints/switch.js'
import {
  addAccessSettingsToUploadCollection,
  addDevelopmentSettingsToUploadCollection,
  modifyUploadCollections,
} from './lib/collectionConfig.js'
import { getDbaFunction } from './lib/db/getDbaFunction.js'
import { getEnv } from './lib/env.js'
import { getModifiedHandler } from './lib/handlers.js'
import { getModifiedAdminThumbnail } from './lib/thumbnailUrl.js'
import type { SwitchEnvPluginArgs } from './types.js'

export function switchEnvPlugin<DBA>({
  db,
  enable = true,
  quickSwitch = false,
}: SwitchEnvPluginArgs<DBA>): Plugin {
  return async (incomingConfig) => {
    if (
      !enable ||
      (typeof process.env.NODE_ENV === 'string' && process.env.NODE_ENV !== 'development')
    ) {
      return incomingConfig
    }

    let config: Config = { ...incomingConfig }

    const env = getEnv()

    config.cookiePrefix = `payload-${env}`

    config.admin = {
      ...(config.admin || {}),

      components: {
        views: {},
        ...(config.admin?.components || {}),
        header: [
          ...(config.admin?.components?.header || []),
          {
            path: '@elliott-w/payload-plugin-switch-env/client#DangerBar',
          },
        ],
        actions: [
          ...(config.admin?.components?.actions || []),
          {
            serverProps: {
              quickSwitch,
            },
            path: '@elliott-w/payload-plugin-switch-env/client#SwitchEnvButton',
          },
        ],
      },
    }

    const getDatabaseAdapter = getDbaFunction(db)

    config.endpoints = [
      ...(config.endpoints || []),
      switchEndpoint({
        getDatabaseAdapter,
      }),
    ]

    config.collections = (config.collections || [])
      .map(addAccessSettingsToUploadCollection)
      .map(addDevelopmentSettingsToUploadCollection)

    const oldInit = config.onInit
    if (oldInit) {
      config.onInit = async (payload) => {
        modifyUploadCollections(payload)
        payload.config.collections
          .filter((c) => c.upload)
          .forEach((collection) => {
            const handlers = collection.upload.handlers
            if (handlers) {
              const handler = handlers.pop()
              if (handler) {
                handlers.push(getModifiedHandler(handler))
              }
            }
            const adminThumbnail = collection.upload.adminThumbnail
            if (adminThumbnail) {
              collection.upload.adminThumbnail = getModifiedAdminThumbnail(
                adminThumbnail,
                config,
                collection,
              )
            }
          })
        if (oldInit) {
          await oldInit(payload)
        }
      }
    }

    config.db = getDatabaseAdapter()

    return config
  }
}
