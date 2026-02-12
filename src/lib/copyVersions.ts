import type { CollectionConfig, GlobalConfig, Payload } from 'payload'
import type { CopyVersionsConfig, CopyVersionsModes, CopyVersionsOverrides } from '../types'

const DEFAULT_COPY_VERSIONS: CopyVersionsModes = { mode: 'all' }
const INTERNAL_MAX_LATEST_X = 100

type CollectionVersionsOverrides = CopyVersionsOverrides<string>
type GlobalVersionsOverrides = CopyVersionsOverrides<string>

export interface ResolvedCopyVersionsConfig {
  default: CopyVersionsModes
  maxX: number
  collections?: CollectionVersionsOverrides
  globals?: GlobalVersionsOverrides
}

interface NormalizeCopyVersionsConfigArgs {
  copyVersions?: CopyVersionsConfig
  warn?: (message: string) => void
}

interface WarnOnInvalidOverrideTargetsArgs {
  copyVersions: ResolvedCopyVersionsConfig
  collections?: CollectionConfig[]
  globals?: GlobalConfig[]
  warn?: (message: string) => void
}

interface ResolveVersionCollectionModesArgs {
  payload: Payload
  copyVersions: ResolvedCopyVersionsConfig
}

export interface VersionCollectionModes {
  [collectionName: string]: CopyVersionsModes
}

export const normalizeCopyVersionsConfig = ({
  copyVersions,
  warn,
}: NormalizeCopyVersionsConfigArgs): ResolvedCopyVersionsConfig => {
  const fromObject = copyVersions || {}

  const maxX = INTERNAL_MAX_LATEST_X

  const defaultMode = normalizeMode(fromObject.default || DEFAULT_COPY_VERSIONS, {
    context: 'copyVersions.default',
    maxX,
    warn,
  })

  const collections = normalizeOverrides(fromObject.collections, 'copyVersions.collections', maxX, warn)
  const globals = normalizeOverrides(fromObject.globals, 'copyVersions.globals', maxX, warn)

  return {
    default: defaultMode,
    maxX,
    collections,
    globals,
  }
}

export const warnOnInvalidOverrideTargets = ({
  copyVersions,
  collections = [],
  globals = [],
  warn,
}: WarnOnInvalidOverrideTargetsArgs): void => {
  const collectionVersionsBySlug = new Map(
    collections.map((collection) => [collection.slug, Boolean(collection.versions)]),
  )
  const globalVersionsBySlug = new Map(globals.map((global) => [global.slug, Boolean(global.versions)]))

  warnOnEntityOverrides({
    overrides: copyVersions.collections,
    enabledBySlug: collectionVersionsBySlug,
    entityName: 'collection',
    warn,
  })
  warnOnEntityOverrides({
    overrides: copyVersions.globals,
    enabledBySlug: globalVersionsBySlug,
    entityName: 'global',
    warn,
  })
}

export const resolveVersionCollectionModes = ({
  payload,
  copyVersions,
}: ResolveVersionCollectionModesArgs): VersionCollectionModes => {
  const versionCollectionModes: VersionCollectionModes = {}

  for (const collection of payload.config.collections || []) {
    if (!collection.versions) {
      continue
    }

    const versions = copyVersions.collections?.[collection.slug]?.versions ?? copyVersions.default
    const collectionName = getVersionCollectionName(payload, collection.slug, collection)
    versionCollectionModes[collectionName] = versions
  }

  for (const global of payload.config.globals || []) {
    if (!global.versions) {
      continue
    }

    const versions = copyVersions.globals?.[global.slug]?.versions ?? copyVersions.default
    const collectionName = getVersionCollectionName(payload, global.slug, global)
    versionCollectionModes[collectionName] = versions
  }

  return versionCollectionModes
}

const normalizeOverrides = (
  overrides: CollectionVersionsOverrides | GlobalVersionsOverrides | undefined,
  contextPrefix: string,
  maxX: number,
  warn?: (message: string) => void,
) => {
  if (!overrides) {
    return undefined
  }

  const normalized: CollectionVersionsOverrides = {}
  for (const slug of Object.keys(overrides)) {
    const entityOptions = overrides[slug]
    if (!entityOptions) {
      continue
    }

    if (typeof entityOptions !== 'object') {
      warn?.(`\`${contextPrefix}.${slug}\` must be an object. Ignoring this override.`)
      continue
    }

    if (!('versions' in entityOptions) || typeof entityOptions.versions === 'undefined') {
      normalized[slug] = {}
      continue
    }

    normalized[slug] = {
      versions: normalizeMode(entityOptions.versions, {
        context: `${contextPrefix}.${slug}.versions`,
        maxX,
        warn,
      }),
    }
  }

  return normalized
}

const normalizeMode = (
  mode: CopyVersionsModes,
  options: {
    context: string
    maxX: number
    warn?: (message: string) => void
  },
): CopyVersionsModes => {
  if (!mode || typeof mode !== 'object' || typeof mode.mode !== 'string') {
    options.warn?.(`\`${options.context}\` must be a valid copy versions mode. Falling back to { mode: 'all' }.`)
    return { mode: 'all' }
  }

  if (mode.mode === 'all' || mode.mode === 'none') {
    return mode
  }

  if (mode.mode === 'latest-x') {
    if (!Number.isInteger(mode.x) || mode.x < 1) {
      options.warn?.(
        `\`${options.context}.x\` must be an integer greater than or equal to 1. Falling back to { mode: 'all' }.`,
      )
      return { mode: 'all' }
    }

    if (mode.x > options.maxX) {
      options.warn?.(
        `\`${options.context}.x\` (${mode.x}) exceeds the internal maximum (${options.maxX}). Clamping to ${options.maxX}.`,
      )
      return { mode: 'latest-x', x: options.maxX }
    }

    return mode
  }

  options.warn?.(
    `\`${options.context}.mode\` must be one of: "all", "latest-x", "none". Falling back to { mode: 'all' }.`,
  )
  return { mode: 'all' }
}

const warnOnEntityOverrides = ({
  overrides,
  enabledBySlug,
  entityName,
  warn,
}: {
  overrides: CollectionVersionsOverrides | GlobalVersionsOverrides | undefined
  enabledBySlug: Map<string, boolean>
  entityName: 'collection' | 'global'
  warn?: (message: string) => void
}) => {
  if (!overrides) {
    return
  }

  for (const slug of Object.keys(overrides)) {
    if (!enabledBySlug.has(slug)) {
      warn?.(
        `\`copyVersions.${entityName === 'collection' ? 'collections' : 'globals'}.${slug}\` does not match any configured ${entityName} slug.`,
      )
      continue
    }

    const versionsEnabled = enabledBySlug.get(slug)
    if (!versionsEnabled) {
      warn?.(
        `\`copyVersions.${entityName === 'collection' ? 'collections' : 'globals'}.${slug}\` is set, but ${entityName} "${slug}" does not have versions enabled.`,
      )
    }
  }
}

const getVersionCollectionName = (
  payload: Payload,
  slug: string,
  config: {
    dbName?: string | ((args: Record<string, never>) => string)
    name?: string
    slug: string
  },
) => {
  const versionModel = (payload.db as { versions?: Record<string, { collection?: { name?: string } }> })
    .versions?.[slug]
  const modelCollectionName = versionModel?.collection?.name
  if (modelCollectionName) {
    return modelCollectionName
  }

  const dbName = resolveDBName(config)
  return `_${dbName}_versions`
}

const resolveDBName = (config: {
  dbName?: string | ((args: Record<string, never>) => string)
  name?: string
  slug: string
}) => {
  if (typeof config.dbName === 'function') {
    return config.dbName({})
  }
  if (typeof config.dbName === 'string' && config.dbName.length > 0) {
    return config.dbName
  }
  if (typeof config.name === 'string' && config.name.length > 0) {
    return config.name
  }

  return config.slug
}
