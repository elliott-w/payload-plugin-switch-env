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
  flattenAllFields,
} from 'payload'
import { getEnv } from './env'

export const addAccessSettingsToUploadCollection = (
  collection: CollectionConfig,
): CollectionConfig => {
  if (collection.upload === true || typeof collection.upload === 'object') {
    return {
      ...collection,
      access: {
        ...(collection.access || {}),
        update: async (args) => {
          const oldUpdate = collection.access?.update
          const result = oldUpdate ? await oldUpdate(args) : true
          if (getEnv() === 'development') {
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
          if (getEnv() === 'development') {
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
): T => {
  if (collection.upload === true || typeof collection.upload === 'object') {
    return {
      ...collection,
      fields: [
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
                if (operation === 'create') {
                  return true
                }
              },
            ],
          },
        },
      ],
    }
  }
  return collection
}

const toggleCreatedDuringDevelopmentField = <T extends SanitizedCollectionConfig>(
  collection: T,
  enabled: boolean,
): T => {
  console.log('toggleCreatedDuringDevelopmentField', enabled)
  const createdDuringDevelopmentField: Field = {
    name: 'createdDuringDevelopment',
    type: 'checkbox',
    defaultValue: false,
    // admin: {
    //   hidden: true,
    // },
    hooks: {
      beforeChange: [
        async ({ operation }) => {
          if (operation === 'create') {
            return true
          }
        },
      ],
    },
  }
  let newFields = collection.fields
  if (enabled) {
    newFields.push(createdDuringDevelopmentField)
  } else {
    newFields = newFields.filter(
      (field) => !('name' in field && field.name === 'createdDuringDevelopment'),
    )
  }
  collection.fields = newFields
  collection.flattenedFields = flattenAllFields({ fields: collection.fields })
  return collection
}

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

export const toggleCloudStorage = <T extends SanitizedCollectionConfig>(
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

export const modifyUploadCollections = (payload: BasePayload) => {
  const env = getEnv()
  payload.config.collections
    .filter((c) => c.upload)
    .forEach((collection) => {
      const production = env === 'production'
      toggleCloudStorage(collection, production)
      toggleLocalStorage(collection, !production)
      toggleCreatedDuringDevelopmentField(collection, !production)
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
