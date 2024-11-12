import { type Args, mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { testEmailAdapter } from './emailAdapter'
import { switchEnvPlugin } from '@elliott-w/payload-plugin-switch-env'
import { s3Storage } from '@payloadcms/storage-s3'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const dbArgs: Args = {
  url: process.env.PRODUCTION_MONGODB_URI!,
}

export default buildConfig({
  admin: {
    autoLogin: {
      email: 'dev@payloadcms.com',
      password: 'test',
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
      upload: true,
    },
  ],
  db: mongooseAdapter(dbArgs),
  email: testEmailAdapter,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'SOME_SECRET',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  plugins: [
    s3Storage({
      bucket: process.env.S3_BUCKET!,
      collections: {
        media: true,
      },
      config: {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
        region: process.env.S3_REGION,
      },
    }),
    switchEnvPlugin({
      quickSwitch: true,
      db: {
        function: mongooseAdapter,
        productionArgs: dbArgs,
        developmentArgs: {
          ...dbArgs,
          url: process.env.DEVELOPMENT_MONGODB_URI || '',
        },
      },
    }),
  ],
  async onInit(payload) {
    const existingUsers = await payload.find({
      collection: 'users',
      limit: 1,
    })

    if (existingUsers.docs.length === 0) {
      await payload.create({
        collection: 'users',
        data: {
          email: 'dev@payloadcms.com',
          password: 'test',
        },
      })
    }
  },
})
