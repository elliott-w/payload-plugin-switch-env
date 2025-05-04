import type { Config, GetAdminThumbnail, UploadConfig } from 'payload'
import type { CollectionConfig } from 'payload'

type AdminThumbnail = UploadConfig['adminThumbnail']

export const getModifiedAdminThumbnail = (
  originalAdminThumbnail: AdminThumbnail,
  config: Config,
  collection: CollectionConfig,
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
  config: Config,
  collection: CollectionConfig,
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
  config: Config
  filename?: string
}

const generateURL = ({ collectionSlug, config, filename }: GenerateURLArgs) => {
  if (filename) {
    return `${config.serverURL || ''}${config.routes?.api || ''}/${collectionSlug}/file/${encodeURIComponent(filename)}`
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
