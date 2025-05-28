import type { DatabaseAdapterObj } from 'payload'

interface DatabaseAdapterArgs<T> {
  function: (args: T) => DatabaseAdapterObj
  productionArgs: T
  developmentArgs: T
}

export type QuickSwitchArgs =
  | {
      /**
       * When switching from production to development, should your development
       * database be overwritten with the production database?
       */
      overwriteDevelopmentDatabase: boolean
    }
  | false

export interface SwitchEnvPluginArgs<DBA> {
  db: DatabaseAdapterArgs<DBA>
  /**
   * Enable or disable the plugin
   * @default true
   */
  enable?: boolean
  /**
   * This will prevent the modal from appearing when clicking the switch button.
   * Instead the environment will be switched immediately.
   * @default false
   */
  quickSwitch?: QuickSwitchArgs
  /**
   * Log the size of the database backup in console when copying production to development
   * @default false
   */
  logDatabaseSize?: boolean
}
