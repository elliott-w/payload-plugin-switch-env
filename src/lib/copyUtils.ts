import type { CollectionConfig, GlobalConfig, Payload } from 'payload'
import type {
  CopyConfig,
  CopyDocumentsMode,
  CopyModeOverrides,
  CopyTargetConfig,
  CopyVersionsMode,
} from '../types'

type CopyMode = CopyDocumentsMode | CopyVersionsMode
type RuntimeCopyVersionsMode = Exclude<CopyVersionsMode, { mode: 'none' }>
const DEFAULT_COPY_MODE: CopyMode = { mode: 'all' }
const INTERNAL_MAX_LATEST_X = 100

type CollectionModeOverrides<TMode extends CopyMode> = CopyModeOverrides<string, TMode>
type GlobalModeOverrides<TMode extends CopyMode> = CopyModeOverrides<string, TMode>

export interface ResolvedCopyTargetConfig<TMode extends CopyMode> {
  default: TMode
  collections?: CollectionModeOverrides<TMode>
  globals?: GlobalModeOverrides<TMode>
}

export interface ResolvedCopyConfig {
  documents: ResolvedCopyTargetConfig<CopyDocumentsMode>
  versions: ResolvedCopyTargetConfig<RuntimeCopyVersionsMode>
}

interface NormalizeCopyConfigArgs {
  copy?: CopyConfig
  warn?: (message: string) => void
}

interface WarnOnInvalidOverrideTargetsArgs {
  copy: ResolvedCopyConfig
  collections?: CollectionConfig[]
  globals?: GlobalConfig[]
  warn?: (message: string) => void
}

interface ResolveVersionCollectionModesArgs {
  payload: Payload
  copy: ResolvedCopyConfig
}

interface ResolvePayloadCollectionScopesArgs {
  payload: Payload
  copy: ResolvedCopyConfig
}

export interface VersionCollectionModes {
  [collectionName: string]: RuntimeCopyVersionsMode
}

export interface CollectionCopyScope {
  mode: CopyDocumentsMode
  filter?: Record<string, unknown>
}

export interface PayloadCollectionScopes {
  [collectionName: string]: CollectionCopyScope[]
}

export const normalizeCopyConfig = ({
  copy,
  warn,
}: NormalizeCopyConfigArgs): ResolvedCopyConfig => {
  const fromObject = copy || {}
  const maxX = INTERNAL_MAX_LATEST_X

  const normalizedVersions = normalizeTargetConfig(fromObject.versions, 'copy.versions', maxX, warn)

  return {
    documents: normalizeTargetConfig(fromObject.documents, 'copy.documents', maxX, warn),
    versions: {
      default: coerceVersionMode(normalizedVersions.default),
      collections: coerceVersionOverrides(normalizedVersions.collections),
      globals: coerceVersionOverrides(normalizedVersions.globals),
    },
  }
}

export const warnOnInvalidOverrideTargets = ({
  copy,
  collections = [],
  globals = [],
  warn,
}: WarnOnInvalidOverrideTargetsArgs): void => {
  const collectionVersionsBySlug = new Map(
    collections.map((collection) => [collection.slug, Boolean(collection.versions)]),
  )
  const globalVersionsBySlug = new Map(
    globals.map((global) => [global.slug, Boolean(global.versions)]),
  )

  warnOnEntityOverrides({
    overrides: copy.documents.collections,
    enabledBySlug: collectionVersionsBySlug,
    entityName: 'collection',
    pathPrefix: 'copy.documents.collections',
    requireVersionsEnabled: false,
    warn,
  })
  warnOnEntityOverrides({
    overrides: copy.documents.globals,
    enabledBySlug: globalVersionsBySlug,
    entityName: 'global',
    pathPrefix: 'copy.documents.globals',
    requireVersionsEnabled: false,
    warn,
  })
  warnOnEntityOverrides({
    overrides: copy.versions.collections,
    enabledBySlug: collectionVersionsBySlug,
    entityName: 'collection',
    pathPrefix: 'copy.versions.collections',
    requireVersionsEnabled: true,
    warn,
  })
  warnOnEntityOverrides({
    overrides: copy.versions.globals,
    enabledBySlug: globalVersionsBySlug,
    entityName: 'global',
    pathPrefix: 'copy.versions.globals',
    requireVersionsEnabled: true,
    warn,
  })
}

export const resolveVersionCollectionModes = ({
  payload,
  copy,
}: ResolveVersionCollectionModesArgs): VersionCollectionModes => {
  const versionCollectionModes: VersionCollectionModes = {}

  for (const collection of payload.config.collections || []) {
    if (!collection.versions) {
      continue
    }

    const mode = copy.versions.collections?.[collection.slug] ?? copy.versions.default
    const collectionName = getVersionCollectionName(payload, collection.slug, collection)
    versionCollectionModes[collectionName] = mode
  }

  for (const global of payload.config.globals || []) {
    if (!global.versions) {
      continue
    }

    const mode = copy.versions.globals?.[global.slug] ?? copy.versions.default
    const collectionName = getVersionCollectionName(payload, global.slug, global)
    versionCollectionModes[collectionName] = mode
  }

  return versionCollectionModes
}

export const resolvePayloadCollectionScopes = ({
  payload,
  copy,
}: ResolvePayloadCollectionScopesArgs): PayloadCollectionScopes => {
  const collectionScopes: PayloadCollectionScopes = {}

  for (const collection of payload.config.collections || []) {
    const mode = copy.documents.collections?.[collection.slug] ?? copy.documents.default
    const collectionName = getBaseCollectionName(payload, collection.slug, collection)
    addCollectionScope(collectionScopes, collectionName, { mode })
  }

  const globalsCollectionName = getGlobalsCollectionName(payload)
  for (const global of payload.config.globals || []) {
    const mode = copy.documents.globals?.[global.slug] ?? copy.documents.default
    addCollectionScope(collectionScopes, globalsCollectionName, {
      mode,
      filter: {
        globalType: global.slug,
      },
    })
  }

  return collectionScopes
}

const addCollectionScope = (
  collectionScopes: PayloadCollectionScopes,
  collectionName: string,
  scope: CollectionCopyScope,
) => {
  if (!collectionScopes[collectionName]) {
    collectionScopes[collectionName] = []
  }
  collectionScopes[collectionName].push(scope)
}

const normalizeTargetConfig = (
  config: CopyTargetConfig<CopyMode> | undefined,
  contextPrefix: string,
  maxX: number,
  warn?: (message: string) => void,
): ResolvedCopyTargetConfig<CopyMode> => {
  const targetConfig = config || {}

  const defaultMode = normalizeMode(targetConfig.default || DEFAULT_COPY_MODE, {
    context: `${contextPrefix}.default`,
    maxX,
    warn,
  })

  const collections = normalizeOverrides(
    targetConfig.collections,
    `${contextPrefix}.collections`,
    maxX,
    warn,
  )
  const globals = normalizeOverrides(targetConfig.globals, `${contextPrefix}.globals`, maxX, warn)

  return {
    default: defaultMode,
    collections,
    globals,
  }
}

const normalizeOverrides = (
  overrides: CollectionModeOverrides<CopyMode> | GlobalModeOverrides<CopyMode> | undefined,
  contextPrefix: string,
  maxX: number,
  warn?: (message: string) => void,
) => {
  if (!overrides) {
    return undefined
  }

  const normalized: CollectionModeOverrides<CopyMode> = {}
  for (const slug of Object.keys(overrides)) {
    const mode = overrides[slug]
    if (typeof mode === 'undefined') {
      continue
    }

    normalized[slug] = normalizeMode(mode, {
      context: `${contextPrefix}.${slug}`,
      maxX,
      warn,
    })
  }

  return normalized
}

const normalizeMode = (
  mode: CopyMode,
  options: {
    context: string
    maxX: number
    warn?: (message: string) => void
  },
): CopyMode => {
  if (!mode || typeof mode !== 'object' || typeof mode.mode !== 'string') {
    options.warn?.(
      `\`${options.context}\` must be a valid copy mode. Falling back to { mode: 'all' }.`,
    )
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

const coerceVersionMode = (mode: CopyVersionsMode): RuntimeCopyVersionsMode => {
  if (mode.mode === 'none') {
    return { mode: 'latest-x', x: 1 }
  }
  return mode
}

const coerceVersionOverrides = (
  overrides: CollectionModeOverrides<CopyMode> | GlobalModeOverrides<CopyMode> | undefined,
): CollectionModeOverrides<RuntimeCopyVersionsMode> | undefined => {
  if (!overrides) {
    return undefined
  }

  const coerced: CollectionModeOverrides<RuntimeCopyVersionsMode> = {}
  for (const slug of Object.keys(overrides)) {
    const mode = overrides[slug]
    if (typeof mode === 'undefined') {
      continue
    }

    coerced[slug] = coerceVersionMode(mode)
  }

  return coerced
}

const warnOnEntityOverrides = ({
  overrides,
  enabledBySlug,
  entityName,
  pathPrefix,
  requireVersionsEnabled,
  warn,
}: {
  overrides: CollectionModeOverrides<CopyMode> | GlobalModeOverrides<CopyMode> | undefined
  enabledBySlug: Map<string, boolean>
  entityName: 'collection' | 'global'
  pathPrefix: string
  requireVersionsEnabled: boolean
  warn?: (message: string) => void
}) => {
  if (!overrides) {
    return
  }

  for (const slug of Object.keys(overrides)) {
    if (!enabledBySlug.has(slug)) {
      warn?.(`\`${pathPrefix}.${slug}\` does not match any configured ${entityName} slug.`)
      continue
    }

    if (requireVersionsEnabled && !enabledBySlug.get(slug)) {
      warn?.(
        `\`${pathPrefix}.${slug}\` is set, but ${entityName} "${slug}" does not have versions enabled.`,
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
  const versionModel = (
    payload.db as { versions?: Record<string, { collection?: { name?: string } }> }
  ).versions?.[slug]
  const modelCollectionName = versionModel?.collection?.name
  if (modelCollectionName) {
    return modelCollectionName
  }

  const dbName = resolveDBName(config)
  return `_${dbName}_versions`
}

const getBaseCollectionName = (
  payload: Payload,
  slug: string,
  config: {
    dbName?: string | ((args: Record<string, never>) => string)
    name?: string
    slug: string
  },
) => {
  const collectionModel = (
    payload.db as {
      collections?: Record<string, { collection?: { name?: string } }>
    }
  ).collections?.[slug]
  const modelCollectionName = collectionModel?.collection?.name
  if (modelCollectionName) {
    return modelCollectionName
  }

  return resolveDBName(config)
}

const getGlobalsCollectionName = (payload: Payload): string => {
  const globalsModel = payload.db as { globals?: { collection?: { name?: string } } }
  const modelCollectionName = globalsModel.globals?.collection?.name
  if (modelCollectionName) {
    return modelCollectionName
  }

  return 'globals'
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
