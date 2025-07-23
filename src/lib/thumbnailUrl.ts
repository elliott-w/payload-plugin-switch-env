import type {
  Config,
  FieldHook,
  GetAdminThumbnail,
  SanitizedCollectionConfig,
  SanitizedConfig,
  UploadConfig,
} from 'payload'
import type { CollectionConfig } from 'payload'

type AdminThumbnail = UploadConfig['adminThumbnail']

export const getModifiedAdminThumbnail = (
  originalAdminThumbnail: AdminThumbnail,
  config: Config | SanitizedConfig,
  collection: CollectionConfig | SanitizedCollectionConfig,
): AdminThumbnail => {
  const getAdminThumbnail: GetAdminThumbnail = (args) => {
    const doc = args.doc
    if (
      typeof doc.createdDuringDevelopment !== 'boolean' ||
      doc.createdDuringDevelopment === true
    ) {
      return null
    } else if (originalAdminThumbnail) {
      return getThumbnailResult(config, collection, originalAdminThumbnail, args)
    } else {
      return null
    }
  }
  return getAdminThumbnail
}

const getThumbnailResult = (
  config: Config | SanitizedConfig,
  collection: CollectionConfig | SanitizedCollectionConfig,
  adminThumbnail: AdminThumbnail,
  args: Parameters<GetAdminThumbnail>[0],
) => {
  if (typeof adminThumbnail === 'function') {
    return adminThumbnail(args)
  }

  if (typeof adminThumbnail === 'string') {
    const url = generateURL({
      collectionSlug: collection.slug,
      config,
      filename: (args.doc as any).sizes?.[adminThumbnail].filename as string,
    })
    if (typeof url === 'undefined') {
      return null
    } else {
      return url
    }
  }
  return null
}

type GenerateURLArgs = {
  collectionSlug: string
  config: Config | SanitizedConfig
  filename?: string
}

const generateURL = ({ collectionSlug, config, filename }: GenerateURLArgs) => {
  if (filename) {
    return `${config.serverURL || ''}${
      config.routes?.api || ''
    }/${collectionSlug}/file/${encodeURIComponent(filename)}`
  }
  return undefined
}

export interface AdminThumbnailArgs {
  basePath: string
  imageSize?: string
}

export const adminThumbnail =
  ({ basePath, imageSize }: AdminThumbnailArgs): GetAdminThumbnail =>
  ({ doc }) => {
    let filename = doc.filename as string
    if (imageSize) {
      const sizeFilename = (doc as any).sizes?.[imageSize].filename as string
      if (sizeFilename) {
        filename = sizeFilename
      }
    }
    return `${basePath}/${doc.prefix ? `${doc.prefix}/` : ''}${filename}`
  }

export const getModifiedAfterReadHook = (afterReadHook: FieldHook): FieldHook => {
  return async (args) => {
    const { path, data, collection } = args
    if (data?.createdDuringDevelopment) {
      let size: string | undefined
      if (path[0] === 'sizes' && typeof path[1] === 'string') {
        size = path[1]
      } else if (path[0] === 'thumbnailURL' && collection) {
        const adminThumbnail = collection.upload.adminThumbnail
        if (typeof adminThumbnail === 'string') {
          size = adminThumbnail
        } else {
          // Resort to smallest size
          size = Object.entries(data?.sizes || {})
            .map(([size, value]) => ({
              size,
              value,
            }))
            .sort((a, b) => (a as any).value.width - (b as any).value.width)[0].size
        }
      }
      const filename = size ? data?.sizes?.[size]?.filename : data?.filename
      const url = generateURL({
        collectionSlug: args.collection?.slug || '',
        config: args.req.payload.config,
        filename,
      })
      return url
    }
    return afterReadHook(args)
  }
}
