import type { Config, Plugin } from 'payload'
import type { SwitchEnvPluginArgs } from './types.js'
import { onInitExtension } from './lib/onInitExtension.js'
import { getEnv } from './lib/env.js'
import { modifyUploadCollection } from './lib/modifyUploadCollection.js'
import { switchEnvGlobal } from './lib/global.js'

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
    if (process.env.NODE_ENV === 'production' || env === 'production') {
      config.db = db.function(db.productionArgs)
    } else {
      config.db = db.function(db.developmentArgs)
    }
    config.cookiePrefix = `payload-${env}`

    config.admin = {
      ...(config.admin || {}),
      components: {
        ...(config.admin?.components || {}),
        actions: [
          ...(config.admin?.components?.actions || []),
          {
            serverProps: {
              quickSwitch,
            },
            path: '@elliott-w/payload-plugin-switch-env#SwitchEnvButton',
          },
        ],
      },
    }

    config.globals = [
      ...(config.globals || []),
      switchEnvGlobal({
        developmentDbaObj: db.function(db.developmentArgs),
      }),
    ]

    if (process.env.NODE_ENV === 'development' && env === 'development') {
      config.collections = (config.collections || []).map(modifyUploadCollection)
      const oldInit = config.onInit
      config.onInit = async (payload) => {
        await onInitExtension(payload)
        if (oldInit) {
          await oldInit(payload)
        }
      }
    }

    return config
  }
}
