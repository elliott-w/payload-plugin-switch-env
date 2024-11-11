import path from 'path'
import os from 'os'

export const backupFile = path.posix.join(os.tmpdir(), 'payload-backup.json')
