import {
  APIError,
  type SanitizedCollectionConfig,
  type CollectionConfig,
  type CollectionSlug,
  type PayloadRequest,
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
          if (process.env.NODE_ENV === 'development' && getEnv() === 'development') {
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
          const env = getEnv()
          if (process.env.NODE_ENV === 'development' && env === 'development') {
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
              async ({ operation, req }) => {
                console.log('beforeChange', operation)
                if (operation === 'create') {
                  return true
                }
              },
            ],
            afterChange: [
              async ({ previousValue, value }) => {
                console.log('previousValue', previousValue, 'value', value)
              },
            ],
          },
        },
      ],
      hooks: {
        ...(collection.hooks || {}),
        beforeChange: [
          ...(collection.hooks?.beforeChange || []),
          async ({ operation, data, req }) => {
            console.log('------ before change collection -------')
            console.log(req.payload.collections.media.config.fields)
            console.log('beforeChange', data)
            if (operation === 'create') {
              data.createdDuringDevelopment = true
            }
            return data
          },
        ],
        afterChange: [
          ...(collection.hooks?.afterChange || []),
          async ({ operation, doc }) => {
            console.log('afterChange', doc)
            return doc
          },
        ],
      },
      upload: {
        ...(collection.upload === true ? {} : collection.upload),
        disableLocalStorage: false,
      },
    }
  }
  return collection
}

export const removeDevelopmentSettingsFromUploadCollection = <
  T extends CollectionConfig | SanitizedCollectionConfig,
>(
  collection: T,
): T => {
  if (collection.upload === true || typeof collection.upload === 'object') {
    const oldFields = collection.fields || []
    const newFields = oldFields.filter(
      (field) => !('name' in field && field.name === 'createdDuringDevelopment'),
    )
    return {
      ...collection,
      fields: newFields,
      upload: {
        ...(collection.upload === true ? {} : collection.upload),
        disableLocalStorage: true,
      },
    }
  }
  return collection
}

const operatingOnAnyDocumentNotCreatedDuringDevelopment = async (
  req: PayloadRequest,
  collectionSlug: CollectionSlug,
  id?: string,
) => {
  const documentIds = Array.from(req.searchParams.entries())
    .filter(([key]) => key.startsWith('where[id][in]'))
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
  return documents.docs.some((doc) => !doc.createdDuringDevelopment)
}
