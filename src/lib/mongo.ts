import { type Connection } from 'mongoose'
import { EJSON } from 'bson'
import { type BasePayload } from 'payload'

/**
 * Creates a JSON string representation of all the collections in the MongoDB database.
 * @param connection - The Mongoose connection to the MongoDB database.
 * @returns A promise that resolves to a JSON string containing the backup data.
 */
export async function backup(connection: Connection): Promise<string> {
  const db = connection.db
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

  return EJSON.stringify(backupData)
}

/**
 * Restores the database with the data from the provided JSON string.
 * @param connection - The Mongoose connection to the MongoDB database.
 * @param jsonString - The JSON string containing the backup data.
 * @returns A promise that resolves to a string indicating the completion of the restore operation.
 */
export async function restore(
  connection: Connection,
  jsonString: string,
  logger: BasePayload['logger'],
): Promise<void> {
  const backupData = EJSON.parse(jsonString) as {
    collections: { [collectionName: string]: any[] }
    indexes: { [collectionName: string]: any[] }
  }
  const db = connection.db

  await connection.dropDatabase()

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
    for (const index of indexes) {
      // Skip _id index as it's created automatically
      if (index.name === '_id_') continue

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
      if (index.partialFilterExpression && Object.keys(index.partialFilterExpression).length > 0) {
        indexOptions.partialFilterExpression = index.partialFilterExpression
      }

      try {
        await collection.createIndex(index.key, indexOptions)
      } catch (error) {
        console.warn(`Failed to create index ${index.name} on ${collectionName}:`, error)
        // Continue with other indexes even if one fails
      }
    }
  }
}
