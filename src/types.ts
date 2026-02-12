import type { CollectionOptions } from '@payloadcms/plugin-cloud-storage/types'
import type {
  CollectionSlug,
  DatabaseAdapterObj,
  GlobalSlug,
  Payload,
  UploadCollectionSlug,
} from 'payload'

interface DatabaseAdapterArgs<T> {
  function: (args: T) => DatabaseAdapterObj
  productionArgs: T
  developmentArgs: T
}

export type Env = 'production' | 'development'
export type GetEnv = (payload?: Payload) => Env | Promise<Env>
export type SetEnv = (env: Env, payload?: Payload) => void | Promise<void>

export type QuickSwitchArgs =
  | {
      /**
       * When switching from production to development, should your development
       * database be overwritten with the production database?
       */
      overwriteDevelopmentDatabase: boolean
    }
  | false

export type DevelopmentFileStorageArgs =
  | {
      mode: 'file-system'
    }
  | {
      mode: 'cloud-storage'
      /** This will prepend a prefix to all files uploaded to
       * cloud storage, taking into account any existing prefix.
       *
       * For example, if set to `staging` and the Media file is `image.png`, and the Media
       * collection prefix is `public`, the file will be uploaded to `staging/public/image.png`
       */
      prefix: string
      /**
       * This must be the same object passed to your cloud storage plugin. This is required so
       * that this plugin can modify the prefix of the files uploaded to cloud storage.
       */
      collections: Partial<
        Record<
          UploadCollectionSlug,
          | {
              prefix?: string
            }
          | true
        >
      >
    }

export type DevelopmentFileStorageMode = DevelopmentFileStorageArgs['mode']

export type ButtonMode = 'switch' | 'copy'

export type CopyMode =
  | { mode: 'all' }
  | { mode: 'none' }
  | {
      mode: 'latest-x'
      /** Minimum value: 1 */
      x: number
    }

export type CopyDocumentsMode = CopyMode
export type CopyVersionsMode = CopyMode

export type CopyModeOverrides<TSlug extends string, TMode> = Partial<Record<TSlug, TMode>>

export interface CopyTargetConfig<TMode> {
  /**
   * Default copy behavior for this target.
   * @default { mode: 'all' }
   */
  default?: TMode
  /**
   * Per-collection overrides by collection slug.
   */
  collections?: CopyModeOverrides<CollectionSlug, TMode>
  /**
   * Per-global overrides by global slug.
   */
  globals?: CopyModeOverrides<GlobalSlug, TMode>
}

export interface CopyConfig {
  /**
   * Configure how base documents are handled when copying the production database to development.
   * - `{ mode: 'all' }`: Copy all documents
   * - `{ mode: 'latest-x'; x: number }`: Copy only the latest x documents
   * - `{ mode: 'none' }`: Do not copy any documents
   * @default { default: { mode: 'all' } }
   */
  documents?: CopyTargetConfig<CopyDocumentsMode>
  /**
   * Configure how version documents are handled when copying the production database to development.
   * - `{ mode: 'all' }`: Copy all versions of all documents
   * - `{ mode: 'latest-x'; x: number }`: Copy only the latest x versions of each document
   * - `{ mode: 'none' }`: Copy only the latest version of each document (`latest: true`)
   * @default { default: { mode: 'all' } }
   */
  versions?: CopyTargetConfig<CopyVersionsMode>
}

export interface SwitchEnvPluginArgs<DBA> {
  /**
   * Changes what the button does in the admin panel. In `switch` mode you can switch
   * between development and production. In `copy` mode the button copies the production
   * database to the development database.
   * @default 'switch'
   */
  buttonMode?: ButtonMode
  /**
   * The database adapter configuration
   */
  db: DatabaseAdapterArgs<DBA>
  /**
   * Whether to store uploaded files in the local file system or in cloud storage while in `development` mode.
   */
  developmentFileStorage?: DevelopmentFileStorageArgs
  /**
   * If true, when `NODE_ENV` is `development` and the development args database url does not
   * contain 'localhost' or '127.0.0.1' the plugin will throw an error.
   * @default true
   */
  developmentSafetyMode?: boolean
  /**
   * Enable or disable the plugin
   * @default true
   */
  enable?: boolean
  /**
   * Log the size of the database backup in console when copying production to development.
   * Incurs a performance penalty for serialization of the database to a string.
   * @default false
   */
  logDatabaseSize?: boolean
  /**
   * This will prevent the modal from appearing when clicking the switch button.
   * Instead the environment will be switched immediately. Only applies to `switch` mode.
   * @default false
   */
  quickSwitch?: QuickSwitchArgs
  copy?: CopyConfig
}
