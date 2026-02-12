import type { CollectionSlug, GlobalSlug, Payload } from 'payload'
import type { CopyVersionsModes } from '../types'

export type CollectionVersionsOverrides = Partial<
  Record<
    CollectionSlug,
    {
      versions?: CopyVersionsModes
    }
  >
>

export type GlobalVersionsOverrides = Partial<
  Record<
    GlobalSlug,
    {
      versions?: CopyVersionsModes
    }
  >
>

export interface ResolveVersionCollectionModesArgs {
  payload: Payload
  defaultVersions: CopyVersionsModes
  collectionOverrides?: CollectionVersionsOverrides
  globalOverrides?: GlobalVersionsOverrides
}

export interface VersionCollectionModes {
  [collectionName: string]: CopyVersionsModes
}

export const resolveVersionCollectionModes = ({
  payload,
  defaultVersions,
  collectionOverrides,
  globalOverrides,
}: ResolveVersionCollectionModesArgs): VersionCollectionModes => {
  const versionCollectionModes: VersionCollectionModes = {}

  for (const collection of payload.config.collections || []) {
    if (!collection.versions) {
      continue
    }

    const versions =
      collectionOverrides?.[collection.slug as CollectionSlug]?.versions ?? defaultVersions
    const collectionName = getVersionCollectionName(payload, collection.slug, collection)
    versionCollectionModes[collectionName] = versions
  }

  for (const global of payload.config.globals || []) {
    if (!global.versions) {
      continue
    }

    const versions = globalOverrides?.[global.slug as GlobalSlug]?.versions ?? defaultVersions
    const collectionName = getVersionCollectionName(payload, global.slug, global)
    versionCollectionModes[collectionName] = versions
  }

  return versionCollectionModes
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
