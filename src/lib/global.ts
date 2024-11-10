import { GlobalConfig } from 'payload'
import { switchEndpoint, SwitchEndpointArgs } from './api-endpoints/switch'
import { switchEnvGlobalSlug } from './slugs'

export const switchEnvGlobal = (switchEndpointArgs: SwitchEndpointArgs): GlobalConfig => {
  return {
    slug: switchEnvGlobalSlug,
    label: 'Switch Environment Settings',
    fields: [],
    admin: {
      hidden: true,
    },
    endpoints: [switchEndpoint(switchEndpointArgs)],
  }
}