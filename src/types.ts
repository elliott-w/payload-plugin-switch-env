import type { DatabaseAdapterObj } from 'payload'

interface DatabaseAdapterArgs<T> {
  function: (args: T) => DatabaseAdapterObj
  productionArgs: T
  developmentArgs: T
}

export interface SwitchEnvPluginArgs<DBA> {
  db: DatabaseAdapterArgs<DBA>
  /**
   * Enable or disable the plugin
   * @default true
   */
  /**
   * @default "./payload.config.ts"
   */
  payloadConfigPath?: string
  enable?: boolean
  /**
   * This will prevent the modal from appearing when clicking the switch button.
   * Instead the environment will be switched immediately. WARNING: If this is
   * set to true, switching from production to development will always copy the
   * production database and overwrite your development database with it.
   * @default false
   */
  quickSwitch?: boolean
}
