import type { DatabaseAdapterObj } from 'payload'

interface DatabaseAdapterArgs<T> {
  function: (args: T) => DatabaseAdapterObj
  productionArgs: T
  developmentArgs: T
}

export type Env = 'production' | 'development'
export type GetEnv = () => Env | Promise<Env>
export type SetEnv = (env: Env) => void | Promise<void>

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
   * Log the size of the database backup in console when copying production to development.
   * Incurs a performance penalty for serialization of the database to a string.
   * @default false
   */
  logDatabaseSize?: boolean
  /**
   * Optionally override the get and set method for the current environment.
   * @default undefined
   */
  envCache?: {
    getEnv: GetEnv
    setEnv: SetEnv
  }
}
