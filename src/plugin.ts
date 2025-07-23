// This import is required for the connection object to be typed on the payload.db object
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { type Plugin } from 'payload'
import { switchEndpoint } from './lib/api-endpoints/switch.js'
import {
  addAccessSettingsToUploadCollection,
  addDevelopmentSettingsToUploadCollection,
  modifyThumbnailUrl,
  switchEnvironments,
} from './lib/collectionConfig.js'
import { getDbaFunction } from './lib/db/getDbaFunction.js'
import { getEnv, setEnv } from './lib/env.js'
import type { SwitchEnvPluginArgs } from './types.js'
import { switchEnvGlobal } from './globals/switchEnvGlobal.js'
import { switchDbConnection } from './lib/db/switchDbConnection.js'
import { copyEndpoint } from './lib/api-endpoints/copy.js'

const basePath = '@elliott-w/payload-plugin-switch-env/client'
const DangerBarPath = `${basePath}#DangerBar`
const AdminButtonPath = `${basePath}#AdminButton`
const SwitchDbConnectionViewPath = `${basePath}#SwitchDbConnectionView`

export function switchEnvPlugin<DBA>({
  buttonMode = 'switch',
  db,
  developmentFileStorage = {
    mode: 'file-system',
  },
  enable = true,
  quickSwitch = false,
  logDatabaseSize = false,
}: SwitchEnvPluginArgs<DBA>): Plugin {
  return async (config) => {
    const developmentFileStorageMode = developmentFileStorage.mode
    config.admin = {
      ...(config.admin || {}),
      dependencies: {
        ...(config.admin?.dependencies || {}),
        [DangerBarPath]: {
          path: DangerBarPath,
          type: 'component',
        },
        [AdminButtonPath]: {
          path: AdminButtonPath,
          type: 'component',
        },
        [SwitchDbConnectionViewPath]: {
          path: SwitchDbConnectionViewPath,
          type: 'component',
        },
      },
    }

    if (!enable) {
      return config
    }

    const getDatabaseAdapter = getDbaFunction(db)

    config.admin = {
      ...(config.admin || {}),
      components: {
        ...(config.admin?.components || {}),
        views: {
          ...(config.admin?.components?.views || {}),
          SwitchDbConnectionView: {
            Component: {
              path: SwitchDbConnectionViewPath,
              serverProps: {
                getDatabaseAdapter,
              },
            },
            path: '/switch-db-connection',
          },
        },
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
              mode: buttonMode,
            },
            path: AdminButtonPath,
          },
        ],
      },
    }

    config.globals = [...(config.globals || []), switchEnvGlobal]

    config.endpoints = [
      ...(config.endpoints || []),
      switchEndpoint({
        getDatabaseAdapter,
        logDatabaseSize,
        getEnv,
        setEnv,
        developmentFileStorage,
      }),
      copyEndpoint({
        getDatabaseAdapter,
        logDatabaseSize,
        getEnv,
      }),
    ]

    config.collections = (config.collections || [])
      .map((collection) => addAccessSettingsToUploadCollection(collection, getEnv))
      .map((collection) =>
        addDevelopmentSettingsToUploadCollection(collection, getEnv, developmentFileStorage),
      )

    if (developmentFileStorageMode === 'file-system') {
      modifyThumbnailUrl(config, getEnv)
    }
    const env = await getEnv()
    switchEnvironments(config, env, developmentFileStorage)

    const oldInit = config.onInit
    config.onInit = async (payload) => {
      // We can't access the payload object (and thus the database) until init
      // So we check the database to see if we're in production or development
      // because the serverless funtion may have been destroyed (along with memory
      // and filesystem)
      const env = await getEnv(payload)
      if (env === 'production') {
        if (buttonMode === 'switch') {
          switchEnvironments(config, 'production', developmentFileStorage)
          await switchDbConnection(payload, 'production', getDatabaseAdapter)
        } else {
          // We never want to be in production env when using the 'copy' buttonMode
          await setEnv('development', payload)
        }
      }
      if (oldInit) {
        await oldInit(payload)
      }
    }

    config.db = getDatabaseAdapter(env)

    return config
  }
}
