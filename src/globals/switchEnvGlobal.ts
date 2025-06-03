import type { GlobalConfig } from 'payload'

export const switchEnvGlobalSlug = 'switchEnv'

export const switchEnvGlobal: GlobalConfig = {
  slug: switchEnvGlobalSlug,
  admin: {
    hidden: true,
  },
  fields: [
    {
      name: 'env',
      type: 'select',
      required: true,
      options: ['development', 'production'],
      defaultValue: 'development',
    },
  ],
}
