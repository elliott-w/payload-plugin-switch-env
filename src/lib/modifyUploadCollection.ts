import {
  APIError,
  type Access,
  type SanitizedCollectionConfig,
  type CollectionConfig,
  type CollectionSlug,
  type PayloadRequest,
} from 'payload'
import { getEnv } from './env'

const collectionMap: Record<
  string,
  {
    update: Access | undefined
    delete: Access | undefined
  }
> = {}

export const addDevelopmentSettingsToUploadCollection = <
  T extends CollectionConfig | SanitizedCollectionConfig,
>(
  collection: T,
): T => {
  if (collection.upload === true || typeof collection.upload === 'object') {
    if (!(collection.slug in collectionMap)) {
      collectionMap[collection.slug] = {
        update: collection.access?.update,
        delete: collection.access?.delete,
      }
    }
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
      upload: {
        ...(collection.upload === true ? {} : collection.upload),
        disableLocalStorage: false,
      },
      access: {
        ...(collection.access || {}),
        update: async (args) => {
          const oldUpdate = collectionMap[collection.slug]?.update
          const result = oldUpdate ? await oldUpdate(args) : true
          if (args.data) {
            return args.data.createdDuringDevelopment
          } else {
            const access = !(await operatingOnAnyDocumentNotCreatedDuringDevelopment(
              args.req,
              collection.slug as CollectionSlug,
            ))
            if (!access) {
              throw new APIError(
                'Cannot update upload collection documents that were not created during development, as it will potentially modify the file(s) in cloud storage.',
              )
            }
            return result
          }
        },
        delete: async (args) => {
          const oldDelete = collectionMap[collection.slug]?.delete
          const result = oldDelete ? await oldDelete(args) : true
          if (args.data) {
            return args.data.createdDuringDevelopment
          } else {
            const access = !(await operatingOnAnyDocumentNotCreatedDuringDevelopment(
              args.req,
              collection.slug as CollectionSlug,
            ))
            if (!access) {
              throw new APIError(
                'Cannot delete upload collection documents that were not created during development, as it will delete the file(s) in cloud storage.',
              )
            }
            return result
          }
        },
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
      access: {
        ...(collection.access || {}),
        update: collectionMap[collection.slug]?.update,
        delete: collectionMap[collection.slug]?.delete,
      },
    }
  }
  return collection
}

const operatingOnAnyDocumentNotCreatedDuringDevelopment = async (
  req: PayloadRequest,
  collectionSlug: CollectionSlug,
) => {
  const documentIds = Array.from(req.searchParams.entries())
    .filter(([key]) => key.startsWith('where[id][in]'))
    .map(([_, value]) => value)

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
