import type { DevelopmentFileStorageMode } from '../types'

export const developmentStorageModeFieldName = 'developmentStorageMode' as const

type StorageModeDoc = {
  [developmentStorageModeFieldName]?: DevelopmentFileStorageMode | null
}

export const getDevelopmentStorageMode = (doc: unknown): DevelopmentFileStorageMode | undefined => {
  if (!doc || typeof doc !== 'object') {
    return undefined
  }

  const typedDoc = doc as StorageModeDoc
  const value = typedDoc[developmentStorageModeFieldName]
  if (value === 'file-system' || value === 'cloud-storage') {
    return value
  }

  return undefined
}
