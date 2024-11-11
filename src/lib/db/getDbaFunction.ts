import { DatabaseAdapter } from 'payload'
import { afterDbConnect } from './afterDbConnect'
import { SwitchEnvPluginArgs } from '../../types'
import { getEnv } from '../env'

export const getDbaFunction =
  <DBA>(dbConfig: SwitchEnvPluginArgs<DBA>['db']) =>
  () => {
    const env = getEnv()
    const isProduction = process.env.NODE_ENV === 'production' || env === 'production'
    const dbaResult = dbConfig.function(
      isProduction ? dbConfig.productionArgs : dbConfig.developmentArgs,
    )
    const originalConigDbInit = dbaResult.init.bind(dbaResult)
    dbaResult.init = function (args) {
      const dba = originalConigDbInit(args)
      dba.payload = args.payload
      const originalDbConnect = dba.connect?.bind(dba)
      dba.connect = async function () {
        if (originalDbConnect) {
          await originalDbConnect()
        }
        await afterDbConnect({
          logger: args.payload.logger,
          db: dba as unknown as DatabaseAdapter,
        })
      }
      return dba
    }
    return dbaResult
  }

export type GetDatabaseAdapter = ReturnType<typeof getDbaFunction>
