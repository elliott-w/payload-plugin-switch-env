import type { GlobalConfig } from 'payload'

export const switchEnvGlobalSlug = 'switchEnv'

export const switchEnvGlobal: GlobalConfig = {
  slug: switchEnvGlobalSlug,
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
