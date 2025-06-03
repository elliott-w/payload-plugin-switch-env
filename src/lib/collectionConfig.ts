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
} from 'payload'
import { getModifiedAfterReadHook } from './thumbnailUrl'
import type { Env, GetEnv } from '../types'

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
          const env = await getEnv()
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
          const env = await getEnv()
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
): T => {
  if (collection.upload === true || typeof collection.upload === 'object') {
    const fields: Field[] = [
      ...(collection.fields || []),
      {
        name: 'createdDuringDevelopment',
        type: 'checkbox',
        defaultValue: false,
        admin: {
          hidden: true,
        },
        hooks: {
          beforeChange: [
            async ({ operation }) => {
              const env = await getEnv()
              if (operation === 'create' && env === 'development') {
                return true
              }
            },
          ],
        },
      },
    ]
    traverseFields({
      callback: ({ field }) => {
        if (field.type === 'text' && (field.name == 'url' || field.name == 'thumbnailURL')) {
          const afterReadHooks = field.hooks?.afterRead
          if (afterReadHooks && afterReadHooks.length > 0) {
            const oldAfterReadHook = afterReadHooks.shift()!
            afterReadHooks.unshift(getModifiedAfterReadHook(oldAfterReadHook))
          }
        }
      },
      fields,
    })
    return {
      ...collection,
      fields,
    }
  }
  return collection
}

/**
 * Toggles whether files get saved to local storage on upload
 */
export const toggleLocalStorage = <T extends SanitizedCollectionConfig>(
  collection: T,
  enabled: boolean,
): T => {
  collection.upload = {
    ...collection.upload,
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
const toggleCollectionHooks = <T extends SanitizedCollectionConfig>(
  collection: T,
  enabled: boolean,
): T => {
  if (enabled) {
    if (hooks[collection.slug]) {
      collection.hooks.beforeChange = [
        ...collection.hooks.beforeChange,
        hooks[collection.slug].beforeChangeHook,
      ]
      collection.hooks.afterDelete = [
        ...collection.hooks.afterDelete,
        hooks[collection.slug].afterDeleteHook,
      ]
      delete hooks[collection.slug]
    }
  } else {
    const beforeChangeHooks = collection.hooks.beforeChange
    const afterDeleteHooks = collection.hooks.afterDelete
    const beforeChangeHook = beforeChangeHooks.at(-1)
    const afterDeleteHook = afterDeleteHooks.at(-1)
    if (beforeChangeHook && afterDeleteHook) {
      hooks[collection.slug] = {
        beforeChangeHook,
        afterDeleteHook,
      }
      collection.hooks.beforeChange.pop()
      collection.hooks.afterDelete.pop()
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
export const toggleUploadProviders = (payload: BasePayload, env: Env) => {
  payload.config.admin.components.providers
    .filter((p) => typeof p === 'object' && 'serverHandlerPath' in p.clientProps)
    .forEach((p) => {
      const provider = p as UploadProvider
      provider.clientProps.enabled = env === 'production'
    })
}

export const switchEnvironments = (payload: BasePayload, env: Env) => {
  modifyUploadCollections(payload, env)
  toggleUploadProviders(payload, env)
}

export const modifyUploadCollections = (payload: BasePayload, env: Env) => {
  payload.config.collections
    .filter((c) => c.upload)
    .forEach((collection) => {
      const production = env === 'production'
      toggleCollectionHooks(collection, production)
      toggleLocalStorage(collection, !production)
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
