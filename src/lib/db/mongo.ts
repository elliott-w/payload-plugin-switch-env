import { type Connection } from 'mongoose'
import { type BasePayload } from 'payload'

export interface BackupData {
  collections: { [collectionName: string]: any[] }
  indexes: { [collectionName: string]: any[] }
}

/**
 * Creates a JSON string representation of all the collections in the MongoDB database.
 * @param connection - The Mongoose connection to the MongoDB database.
 * @returns A promise that resolves to a JSON string containing the backup data.
 */
export async function backup(connection: Connection): Promise<BackupData> {
  const db = connection.db
  if (!db) {
    throw new Error('Could not make backup: database connection not established')
  }
  const collections = await db.listCollections().toArray()

  const backupData: {
    collections: { [collectionName: string]: any[] }
    indexes: { [collectionName: string]: any[] }
  } = {
    collections: {},
    indexes: {},
  }

  for (const collectionInfo of collections) {
    const collectionName = collectionInfo.name
    const collection = db.collection(collectionName)

    // Backup documents
    const documents = await collection.find({}).toArray()
    backupData.collections[collectionName] = documents

    // Backup indexes
    const indexes = await collection.indexes()
    backupData.indexes[collectionName] = indexes
  }

  return backupData
}

/**
 * Restores the database with the data from the provided base64 string.
 * @param connection - The Mongoose connection to the MongoDB database.
 * @param base64String - The base64 string containing the serialized backup data.
 */
export async function restore(
  connection: Connection,
  backupData: BackupData,
  logger: BasePayload['logger'],
): Promise<void> {
  const db = connection.db
  if (!db) {
    throw new Error('Could not restore database: database connection not established')
  }

  try {
    await connection.dropDatabase()
  } catch (error) {
    logger.debug('Failed to drop database, deleting all documents in every collection instead')
    const existingCollections = await db.listCollections().toArray()
    // Drop each existing collection in parallel
    await Promise.all(
      existingCollections.map(async (collectionInfo) => {
        const collection = db.collection(collectionInfo.name)
        try {
          await collection.deleteMany({})
        } catch (error) {
          logger.warn(error, `Failed to delete documents from collection ${collectionInfo.name}`)
        }
      }),
    )
  }

  const allIndexResults: Array<{
    success: boolean
    index: any
    error?: any
    collectionName: string
  }> = []

  for (const collectionName in backupData.collections) {
    const documents = backupData.collections[collectionName]
    const collection = db.collection(collectionName)

    // Restore documents
    if (documents.length > 0) {
      logger.debug(`Inserting ${documents.length} documents into ${collectionName}`)
      await collection.insertMany(documents)
    }

    // Restore indexes
    const indexes = backupData.indexes[collectionName] || []
    // Create all indexes in parallel
    const indexResults = await Promise.all(
      indexes
        .filter((index) => index.name !== '_id_') // Skip _id index as it's created automatically
        .map(async (index) => {
          logger.debug(`Creating index ${index.name} on ${collectionName}`)

          // Create options object with only essential properties
          const indexOptions: Record<string, any> = {
            name: index.name,
            background: true, // This is generally safe to always include
          }

          // Only add optional properties if they are explicitly true
          if (index.unique === true) indexOptions.unique = true
          if (index.sparse === true) indexOptions.sparse = true
          if (typeof index.expireAfterSeconds === 'number')
            indexOptions.expireAfterSeconds = index.expireAfterSeconds
          if (
            index.partialFilterExpression &&
            Object.keys(index.partialFilterExpression).length > 0
          ) {
            indexOptions.partialFilterExpression = index.partialFilterExpression
          }

          try {
            await collection.createIndex(index.key, indexOptions)
            return { success: true, index, collectionName }
          } catch (error) {
            return { success: false, index, error, collectionName }
          }
        }),
    )

    allIndexResults.push(...indexResults)
  }

  // Check results and log summary across all collections
  const allFailed = allIndexResults.every((result) => !result.success)
  if (allFailed && allIndexResults.length > 0) {
    logger.warn('Failed to create indexes (your development database might not support it)')
  } else {
    // Only log individual failures if not all indexes failed
    const failedResults = allIndexResults.filter((result) => !result.success)
    for (const result of failedResults) {
      logger.warn(
        result.error,
        `Failed to create index ${result.index.name} on collection ${result.collectionName}`,
      )
    }
  }
}
