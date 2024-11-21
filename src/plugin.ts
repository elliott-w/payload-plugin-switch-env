import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import type { Config, Plugin } from 'payload'
import type { SwitchEnvPluginArgs } from './types.js'
import { getEnv } from './lib/env.js'
import {
  addAccessSettingsToUploadCollection,
  modifyUploadCollections,
} from './lib/modifyUploadCollection.js'
import { switchEnvGlobal } from './lib/global.js'
import { getDbaFunction } from './lib/db/getDbaFunction.js'

export function switchEnvPlugin<DBA>({
  db,
  enable = true,
  quickSwitch = false,
}: SwitchEnvPluginArgs<DBA>): Plugin {
  return async (incomingConfig) => {
    if (!enable) {
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

    config.globals = [
      ...(config.globals || []),
      switchEnvGlobal({
        getDatabaseAdapter,
      }),
    ]

    config.collections = (config.collections || []).map(addAccessSettingsToUploadCollection)

    const oldInit = config.onInit
    if (oldInit) {
      config.onInit = async (payload) => {
        if (process.env.NODE_ENV === 'development') {
          modifyUploadCollections(payload)
        }
        if (oldInit) {
          await oldInit(payload)
        }
      }
    }

    config.db = getDatabaseAdapter()

    return config
  }
}
