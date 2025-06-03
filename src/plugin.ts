// This import is required for the connection object to be typed on the payload.db object
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { type Plugin } from 'payload'
import { switchEndpoint } from './lib/api-endpoints/switch.js'
import {
  addAccessSettingsToUploadCollection,
  addDevelopmentSettingsToUploadCollection,
  switchEnvironments,
} from './lib/collectionConfig.js'
import { getDbaFunction } from './lib/db/getDbaFunction.js'
import { getEnv as getEnvDefault, setEnv as setEnvDefault } from './lib/env.js'
import { getModifiedHandler } from './lib/handlers.js'
import { getModifiedAdminThumbnail, getModifiedAfterReadHook } from './lib/thumbnailUrl.js'
import type { SwitchEnvPluginArgs } from './types.js'
import { switchEnvGlobal } from './globals/switchEnvGlobal.js'
import { switchDbConnection } from './lib/db/switchDbConnection.js'

const basePath = '@elliott-w/payload-plugin-switch-env/client'
const DangerBarPath = `${basePath}#DangerBar`
const SwitchEnvButtonPath = `${basePath}#SwitchEnvButton`

export function switchEnvPlugin<DBA>({
  db,
  enable = true,
  quickSwitch = false,
  logDatabaseSize = false,
  envCache,
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

    const getEnv = envCache?.getEnv ?? getEnvDefault
    const setEnv = envCache?.setEnv ?? setEnvDefault

    config.admin = {
      ...(config.admin || {}),
      components: {
        views: {},
        ...(config.admin?.components || {}),
        header: [
          ...(config.admin?.components?.header || []),
          {
            path: DangerBarPath,
            serverProps: {
              getEnv,
            },
          },
        ],
        actions: [
          ...(config.admin?.components?.actions || []),
          {
            serverProps: {
              quickSwitch,
              getEnv,
            },
            path: SwitchEnvButtonPath,
          },
        ],
      },
    }

    config.globals = [...(config.globals || []), switchEnvGlobal]

    const getDatabaseAdapter = getDbaFunction(db)

    config.endpoints = [
      ...(config.endpoints || []),
      switchEndpoint({
        getDatabaseAdapter,
        logDatabaseSize,
        getEnv,
        setEnv,
      }),
    ]

    config.collections = (config.collections || [])
      .map((collection) => addAccessSettingsToUploadCollection(collection, getEnv))
      .map((collection) => addDevelopmentSettingsToUploadCollection(collection, getEnv))

    const oldInit = config.onInit
    if (oldInit) {
      config.onInit = async (payload) => {
        const env = await getEnv(payload)
        if (env === 'production') {
          await switchDbConnection(payload, 'production', getDatabaseAdapter)
        }
        switchEnvironments(payload, env)
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
                handlers.push(getModifiedHandler(handler, getEnv))
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

    config.db = getDatabaseAdapter('development')

    return config
  }
}
