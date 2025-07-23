import {
  APIError,
  type SanitizedCollectionConfig,
  type CollectionConfig,
  type CollectionSlug,
  type PayloadRequest,
  type BasePayload,
  type CollectionBeforeChangeHook,
  type CollectionAfterDeleteHook,
  type Field,
  traverseFields,
  type SanitizedConfig,
  type Config,
  type TextField,
} from 'payload'
import {
  getModifiedAdminThumbnail,
  getModifiedAfterReadHook as getModifiedThumbnailUrlAfterReadHook,
} from './thumbnailUrl'
import type { DevelopmentFileStorageArgs, DevelopmentFileStorageMode, Env, GetEnv } from '../types'
import { getModifiedHandler } from './handlers'
import path from 'path'

export const addAccessSettingsToUploadCollection = (
  collection: CollectionConfig,
  getEnv: GetEnv,
): CollectionConfig => {
  if (collection.upload === true || typeof collection.upload === 'object') {
    return {
      ...collection,
      access: {
        ...(collection.access || {}),
        update: async (args) => {
          const oldUpdate = collection.access?.update
          const result = oldUpdate ? await oldUpdate(args) : true
          const env = await getEnv(args.req.payload)
          if (env === 'development') {
            if (args.data) {
              return !!args.data.createdDuringDevelopment
            } else {
              const access = !(await operatingOnAnyDocumentNotCreatedDuringDevelopment(
                args.req,
                collection.slug as CollectionSlug,
                args.id?.toString(),
              ))
              if (!access) {
                throw new APIError(
                  'Cannot update upload collection documents that were not created during development, as it will potentially modify the file(s) in cloud storage.',
                )
              }
              return result
            }
          }
          return result
        },
        delete: async (args) => {
          const oldDelete = collection.access?.delete
          const result = oldDelete ? await oldDelete(args) : true
          const env = await getEnv(args.req.payload)
          if (env === 'development') {
            if (args.data) {
              return !!args.data.createdDuringDevelopment
            } else {
              const access = !(await operatingOnAnyDocumentNotCreatedDuringDevelopment(
                args.req,
                collection.slug as CollectionSlug,
                args.id?.toString(),
              ))
              if (!access) {
                throw new APIError(
                  'Cannot delete upload collection documents that were not created during development, as it will delete the file(s) in cloud storage.',
                )
              }
              return result
            }
          }
          return result
        },
      },
    }
  }
  return collection
}

export const addDevelopmentSettingsToUploadCollection = <
  T extends CollectionConfig | SanitizedCollectionConfig,
>(
  collection: T,
  getEnv: GetEnv,
  developmentFileStorage: DevelopmentFileStorageArgs,
): T => {
  if (collection.upload === true) {
    collection.upload = {}
  }
  if (collection.upload) {
    if (!collection.upload.handlers) {
      collection.upload.handlers = []
    }
    // See
    collection.upload.handlers.unshift(async (req, args) => {
      if ('clientUploadContext' in args.params) {
        const env = await getEnv(req.payload)
        if (env === 'development' && developmentFileStorage.mode === 'cloud-storage') {
          const clientUploadContext = args.params.clientUploadContext as {
            prefix?: string
          }
          clientUploadContext.prefix = path.posix.join(
            developmentFileStorage.prefix,
            clientUploadContext.prefix || '',
          )
        }
      }
    })
    const developmentFileStorageMode = developmentFileStorage.mode
    const fields: Field[] = [
      ...(collection.fields || []),
      {
        name: 'createdDuringDevelopment',
        type: 'checkbox',
        defaultValue: false,
        admin: {
          hidden: true,
        },
      },
    ]
    if (developmentFileStorageMode === 'file-system') {
      traverseFields({
        callback: ({ field }) => {
          if (field.type === 'text' && (field.name == 'url' || field.name == 'thumbnailURL')) {
            const afterReadHooks = field.hooks?.afterRead
            if (afterReadHooks && afterReadHooks.length > 0) {
              const oldAfterReadHook = afterReadHooks.shift()!
              afterReadHooks.unshift(getModifiedThumbnailUrlAfterReadHook(oldAfterReadHook))
            }
          }
        },
        fields,
      })
    }
    return {
      ...collection,
      fields,
      hooks: {
        ...(collection.hooks || {}),
        beforeChange: [
          async ({ operation, req: { payload }, data }) => {
            const env = await getEnv(payload)
            if (operation === 'create' && env === 'development' && data) {
              data.createdDuringDevelopment = true
            }
            return data
          },
          getModifiedPrefixBeforeChangeHook(developmentFileStorage),
          ...(collection.hooks?.beforeChange || []),
        ],
      },
    }
  }
  return collection
}

/**
 * Toggles whether files get saved to local storage on upload
 */
export const toggleLocalStorage = <T extends CollectionConfig | SanitizedCollectionConfig>(
  collection: T,
  enabled: boolean,
): T => {
  collection.upload = {
    ...(typeof collection.upload === 'object' && collection.upload),
    disableLocalStorage: !enabled,
  }
  return collection
}

interface UploadHooks {
  beforeChangeHook: CollectionBeforeChangeHook
  afterDeleteHook: CollectionAfterDeleteHook
}

const hooks: Record<CollectionSlug, UploadHooks> = {}

/**
 * Prevents files from being uploaded (beforeChange) or deleted (afterDelete)
 * by removing those hooks in development
 */
const toggleCollectionHooks = <T extends CollectionConfig | SanitizedCollectionConfig>(
  collection: T,
  enabled: boolean,
): T => {
  if (enabled) {
    if (hooks[collection.slug]) {
      collection.hooks = {
        ...(collection.hooks || {}),
        beforeChange: [
          ...(collection.hooks?.beforeChange || []),
          hooks[collection.slug].beforeChangeHook,
        ],
        afterDelete: [
          ...(collection.hooks?.afterDelete || []),
          hooks[collection.slug].afterDeleteHook,
        ],
      }
      delete hooks[collection.slug]
    }
  } else {
    const beforeChangeHooks = collection.hooks?.beforeChange || []
    const afterDeleteHooks = collection.hooks?.afterDelete || []
    const beforeChangeHook = beforeChangeHooks.at(-1)
    const afterDeleteHook = afterDeleteHooks.at(-1)
    if (beforeChangeHook && afterDeleteHook) {
      hooks[collection.slug] = {
        beforeChangeHook,
        afterDeleteHook,
      }
      beforeChangeHooks.pop()
      afterDeleteHooks.pop()
    }
  }
  return collection
}

type UploadProvider = {
  clientProps: {
    collectionSlug: string
    enabled: boolean
    prefix?: string
    serverHandlerPath: string
  }
  path: string
}

/**
 * If using clientUploads config, this will ensure that files don't
 * get directly uploaded to cloud storage using signed urls
 */
export const toggleUploadProviders = (
  config: Config | SanitizedConfig,
  env: Env,
  developmentFileStorageMode: DevelopmentFileStorageMode,
) => {
  config.admin = {
    ...(config.admin || {}),
    components: {
      ...(config.admin?.components || {}),
      providers: (config.admin?.components?.providers || []).map((p) => {
        if (typeof p === 'object' && p.clientProps && 'serverHandlerPath' in p.clientProps) {
          const provider = p as UploadProvider
          const enabled = env === 'production' || developmentFileStorageMode === 'cloud-storage'
          provider.clientProps.enabled = enabled
        }
        return p
      }),
    },
  }
}

export const modifyThumbnailUrl = (config: Config | SanitizedConfig, getEnv: GetEnv) => {
  const collections = (config.collections || []) as (CollectionConfig | SanitizedCollectionConfig)[]
  collections
    .filter((c) => c.upload)
    .forEach((collection) => {
      const fields =
        'flattenedFields' in collection ? collection.flattenedFields : collection.fields
      const thumbnailUrlField = fields.find(
        (field) => field.type === 'text' && field.name === 'thumbnailURL',
      ) as TextField
      if (thumbnailUrlField) {
        const afterReadHooks = thumbnailUrlField.hooks?.afterRead
        if (afterReadHooks && afterReadHooks.length > 0) {
          const oldAfterReadHook = afterReadHooks.shift()!
          afterReadHooks.unshift(getModifiedThumbnailUrlAfterReadHook(oldAfterReadHook))
        }
      }
      if (typeof collection.upload === 'boolean' && collection.upload) {
        collection.upload = {}
      }
      if (collection.upload) {
        const handlers = [
          ...(typeof collection.upload === 'object' && Array.isArray(collection.upload.handlers)
            ? collection.upload.handlers
            : []),
        ]
        if (handlers.length > 0) {
          const handler = handlers.pop()
          if (handler) {
            handlers.push(getModifiedHandler(handler, getEnv))
          }
        }
        const adminThumbnail =
          typeof collection.upload === 'object' ? collection.upload.adminThumbnail : undefined
        if (adminThumbnail) {
          collection.upload.adminThumbnail = getModifiedAdminThumbnail(
            adminThumbnail,
            config,
            collection,
          )
        }
      }
    })
}

const getModifiedPrefixBeforeChangeHook = (
  developmentFileStorage: DevelopmentFileStorageArgs,
): CollectionBeforeChangeHook => {
  return async (args) => {
    const { data } = args
    if (data?.createdDuringDevelopment) {
      if (developmentFileStorage.mode === 'cloud-storage' && developmentFileStorage.prefix) {
        data.prefix = path.posix.join(developmentFileStorage.prefix, data.prefix || '')
      }
    }
    return data
  }
}

export const modifyPrefix = <T extends CollectionConfig | SanitizedCollectionConfig>(
  collection: T,
  developmentFileStorage: DevelopmentFileStorageArgs,
): T => {
  if (collection.upload) {
    collection.hooks = {
      ...(collection.hooks || {}),
      beforeChange: [
        getModifiedPrefixBeforeChangeHook(developmentFileStorage),
        ...(collection.hooks?.beforeChange || []),
      ],
    }
  }
  return collection
}

export const switchEnvironments = (
  config: Config | SanitizedConfig,
  env: Env,
  developmentFileStorage: DevelopmentFileStorageArgs,
) => {
  if (developmentFileStorage.mode === 'cloud-storage') {
    Object.values(developmentFileStorage.collections).forEach((collectionOptions) => {
      if (typeof collectionOptions === 'object' && typeof collectionOptions.prefix === 'string') {
        const devPrefix = developmentFileStorage.prefix
        if (env === 'development') {
          if (!collectionOptions.prefix.includes(devPrefix)) {
            collectionOptions.prefix = path.posix.join(devPrefix, collectionOptions.prefix || '')
          }
        } else {
          if (collectionOptions.prefix.startsWith(devPrefix)) {
            collectionOptions.prefix = collectionOptions.prefix.replace(devPrefix + '/', '')
          }
        }
      }
    })
  }
  modifyUploadCollections(config.collections || [], env, developmentFileStorage)
  toggleUploadProviders(config, env, developmentFileStorage.mode)
}

export const modifyUploadCollections = (
  collections: (CollectionConfig | SanitizedCollectionConfig)[],
  env: Env,
  developmentFileStorage: DevelopmentFileStorageArgs,
) => {
  const production = env === 'production'
  collections
    .filter((c) => c.upload)
    .forEach((collection) => {
      toggleCollectionHooks(
        collection,
        production || developmentFileStorage.mode === 'cloud-storage',
      )
      toggleLocalStorage(collection, !production && developmentFileStorage.mode === 'file-system')
    })
}

const operatingOnAnyDocumentNotCreatedDuringDevelopment = async (
  req: PayloadRequest,
  collectionSlug: CollectionSlug,
  id?: string,
) => {
  const documentIds = Array.from(req.searchParams.entries())
    .filter(([key, _]) => key.includes('id'))
    .map(([_, value]) => value)

  if (id) {
    documentIds.push(id)
  }

  if (documentIds.length == 0) {
    return false
  }
  const documents = await req.payload.find({
    collection: collectionSlug,
    where: {
      id: { in: documentIds },
    },
  })
  return documents.docs.some(
    (doc) =>
      typeof doc.createdDuringDevelopment !== 'boolean' || doc.createdDuringDevelopment === false,
  )
}
