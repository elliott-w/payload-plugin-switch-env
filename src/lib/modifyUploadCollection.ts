import { APIError, type CollectionConfig, type CollectionSlug, type PayloadRequest } from 'payload'

export const modifyUploadCollection = (collection: CollectionConfig): CollectionConfig => {
  if (typeof collection.upload === 'object') {
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
        ...collection.upload,
        disableLocalStorage: false,
      },
      access: {
        ...(collection.access || {}),
        update: async (args) => {
          const result = collection.access?.update ? await collection.access.update(args) : true
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
          const result = collection.access?.delete ? await collection.access.delete(args) : true
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
