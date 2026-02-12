import { type Args, mongooseAdapter } from '@payloadcms/db-mongodb'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { switchEnvPlugin, adminThumbnail } from '@elliott-w/payload-plugin-switch-env'
import { s3Storage, type S3StorageOptions } from '@payloadcms/storage-s3'
import sharp from 'sharp'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const dbArgs: Args = {
  url: process.env.PRODUCTION_MONGODB_URI!,
}

const isDev = process.env.NODE_ENV === 'development'
const adminEmail = process.env.ADMIN_EMAIL
const s3StorageCollections: S3StorageOptions['collections'] = {
  media: {
    prefix: 'public',
    disablePayloadAccessControl: true,
    generateFileURL: ({ filename, prefix }) => {
      const result = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${prefix}/${filename}`
      return result
    },
  },
}

export default buildConfig({
  db: mongooseAdapter(dbArgs),
  plugins: [
    s3Storage({
      bucket: process.env.S3_BUCKET!,
      collections: s3StorageCollections,
      clientUploads: true,
      config: {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
        region: process.env.S3_REGION,
      },
    }),
    switchEnvPlugin({
      db: {
        function: mongooseAdapter,
        productionArgs: dbArgs,
        developmentArgs: {
          ...dbArgs,
          url: process.env.DEVELOPMENT_MONGODB_URI || '',
        },
      },
      buttonMode: 'switch',
      developmentFileStorage: {
        mode: 'cloud-storage',
        prefix: 'staging',
        collections: s3StorageCollections,
      },
      copy: {
        versions: {
          default: {
            mode: 'latest-x',
            x: 3,
          },
        },
      },
    }),
  ],
  admin: {
    autoLogin: Boolean(isDev && adminEmail) && {
      email: adminEmail,
    },
    user: 'users',
  },
  collections: [
    {
      slug: 'users',
      auth: true,
      fields: [],
    },
    {
      slug: 'pages',
      versions: {
        drafts: true,
      },
      admin: {
        useAsTitle: 'title',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
        },
      ],
    },
    {
      slug: 'media',
      fields: [
        {
          name: 'text',
          type: 'text',
        },
      ],
      upload: {
        adminThumbnail: adminThumbnail({
          basePath: `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`,
          imageSize: 'thumbnail',
        }),
        imageSizes: [
          {
            name: 'thumbnail',
            width: 300,
            height: 300,
          },
        ],
      },
    },
  ],
  globals: [
    {
      slug: 'versionedGlobal',
      versions: {
        drafts: true,
      },
      fields: [
        {
          name: 'test',
          type: 'text',
        },
      ],
    },
  ],
  secret: process.env.PAYLOAD_SECRET || 'SOME_SECRET',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  async onInit(payload) {
    const existingUsers = await payload.find({
      collection: 'users',
      limit: 1,
    })

    if (existingUsers.docs.length === 0) {
      await payload.create({
        collection: 'users',
        data: {
          email: adminEmail ?? 'dev@payloadcms.com',
          password: 'test',
        },
      })
    }
  },
  sharp,
})
