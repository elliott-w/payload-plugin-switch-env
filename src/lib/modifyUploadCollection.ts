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
                if (operation === 'create' && getEnv() === 'development') {
                  return true
                }
              },
            ],
          },
        },
      ],
      upload: {
        ...(collection.upload === true ? {} : collection.upload),
        disableLocalStorage: false,
      },
    }
  }
  return collection
}

const removeDevelopmentSettingsFromUploadCollection = <
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
