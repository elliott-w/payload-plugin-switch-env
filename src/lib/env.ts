import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'

const tmpFile = path.posix.join(os.tmpdir(), 'payload-env.txt')

export type Env = 'production' | 'development'

export const getEnv = (): Env => {
  if (existsSync(tmpFile)) {
    return readFileSync(tmpFile, 'utf8') as Env
  } else {
    return 'development'
  }
}

export const setEnv = (env: Env) => {
  writeFileSync(tmpFile, env)
}
