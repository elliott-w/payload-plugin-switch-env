import { type GetEnv, type SwitchEnvPluginArgs } from '../../types'

export const getDbaFunction =
  <DBA>(dbConfig: SwitchEnvPluginArgs<DBA>['db'], getEnv: GetEnv) =>
  async () => {
    const env = await getEnv()
    const isProduction = env === 'production'
    const dbaResult = dbConfig.function(
      isProduction ? dbConfig.productionArgs : dbConfig.developmentArgs,
    )
    return dbaResult
  }

export type GetDatabaseAdapter = ReturnType<typeof getDbaFunction>
