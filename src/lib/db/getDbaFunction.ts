import { type SwitchEnvPluginArgs } from '../../types'
import { getEnv } from '../env'

export const getDbaFunction =
  <DBA>(dbConfig: SwitchEnvPluginArgs<DBA>['db']) =>
  () => {
    const env = getEnv()
    const isProduction = process.env.NODE_ENV === 'production' || env === 'production'
    const dbaResult = dbConfig.function(
      isProduction ? dbConfig.productionArgs : dbConfig.developmentArgs,
    )
    return dbaResult
  }

export type GetDatabaseAdapter = ReturnType<typeof getDbaFunction>
