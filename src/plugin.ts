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
import {
  normalizeCopyVersionsConfig,
  warnOnInvalidOverrideTargets,
} from './lib/copyVersions.js'

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
  developmentSafetyMode = true,
  copyVersions,
}: SwitchEnvPluginArgs<DBA>): Plugin {
  return async (config) => {
    const copyVersionsWarnings: string[] = []
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

    if (process.env.NODE_ENV === 'development') {
      const developmentDbArgs = db.developmentArgs as object
      if (
        typeof developmentDbArgs === 'object' &&
        'url' in developmentDbArgs &&
        typeof developmentDbArgs.url === 'string' &&
        developmentDbArgs.url
      ) {
        if (
          !(
            developmentDbArgs.url.includes('localhost') ||
            developmentDbArgs.url.includes('127.0.0.1')
          )
        ) {
          if (developmentSafetyMode) {
            throw new Error(
              'Development database url does not contain "localhost" or "127.0.0.1". To disable this check, set the `developmentSafetyMode` plugin argument to false.',
            )
          } else {
            console.warn(
              '\x1b[31mWARNING: Your development database url does not contain "localhost" or "127.0.0.1". You may be in danger of overwriting your production database!\x1b[0m',
            )
          }
        }
      }
    }

    const getDatabaseAdapter = getDbaFunction(db)
    const resolvedCopyVersions = normalizeCopyVersionsConfig({
      copyVersions,
      warn: (message) => {
        copyVersionsWarnings.push(message)
      },
    })
    warnOnInvalidOverrideTargets({
      copyVersions: resolvedCopyVersions,
      collections: config.collections || [],
      globals: config.globals || [],
      warn: (message) => {
        copyVersionsWarnings.push(message)
      },
    })

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
        copyVersions: resolvedCopyVersions,
      }),
      copyEndpoint({
        getDatabaseAdapter,
        logDatabaseSize,
        getEnv,
        copyVersions: resolvedCopyVersions,
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
      for (const warning of copyVersionsWarnings) {
        payload.logger.warn(`[payload-plugin-switch-env] ${warning}`)
      }

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
