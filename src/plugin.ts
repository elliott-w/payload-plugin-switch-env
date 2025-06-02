// This import is required for the connection object to be typed on the payload.db object
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { traverseFields, type Config, type Plugin } from 'payload'
import { switchEndpoint } from './lib/api-endpoints/switch.js'
import {
  addAccessSettingsToUploadCollection,
  addDevelopmentSettingsToUploadCollection,
  switchEnvironments,
} from './lib/collectionConfig.js'
import { getDbaFunction } from './lib/db/getDbaFunction.js'
import { getEnv } from './lib/env.js'
import { getModifiedHandler } from './lib/handlers.js'
import { getModifiedAdminThumbnail, getModifiedAfterReadHook } from './lib/thumbnailUrl.js'
import type { SwitchEnvPluginArgs } from './types.js'

const basePath = '@elliott-w/payload-plugin-switch-env/client'
const DangerBarPath = `${basePath}#DangerBar`
const SwitchEnvButtonPath = `${basePath}#SwitchEnvButton`

export function switchEnvPlugin<DBA>({
  db,
  enable = true,
  quickSwitch = false,
  logDatabaseSize = false,
}: SwitchEnvPluginArgs<DBA>): Plugin {
  return async (config) => {
    config.admin = {
      ...(config.admin || {}),
      dependencies: {
        ...(config.admin?.dependencies || {}),
        [DangerBarPath]: {
          path: DangerBarPath,
          type: 'component',
        },
        [SwitchEnvButtonPath]: {
          path: SwitchEnvButtonPath,
          type: 'component',
        },
      },
    }

    if (!enable) {
      return config
    }

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
            path: DangerBarPath,
          },
        ],
        actions: [
          ...(config.admin?.components?.actions || []),
          {
            serverProps: {
              quickSwitch,
            },
            path: SwitchEnvButtonPath,
          },
        ],
      },
    }

    const getDatabaseAdapter = getDbaFunction(db)

    config.endpoints = [
      ...(config.endpoints || []),
      switchEndpoint({
        getDatabaseAdapter,
        logDatabaseSize,
      }),
    ]

    config.collections = (config.collections || [])
      .map(addAccessSettingsToUploadCollection)
      .map(addDevelopmentSettingsToUploadCollection)

    const oldInit = config.onInit
    if (oldInit) {
      config.onInit = async (payload) => {
        switchEnvironments(payload)
        payload.config.collections
          .filter((c) => c.upload)
          .forEach((collection) => {
            const thumbnailUrlField = collection.flattenedFields.find(
              (field) => field.type === 'text' && field.name === 'thumbnailURL',
            )
            if (thumbnailUrlField) {
              const afterReadHooks = thumbnailUrlField.hooks?.afterRead
              if (afterReadHooks && afterReadHooks.length > 0) {
                const oldAfterReadHook = afterReadHooks.shift()!
                afterReadHooks.unshift(getModifiedAfterReadHook(oldAfterReadHook))
              }
            }
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
