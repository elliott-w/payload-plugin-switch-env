import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'

const tmpFile = path.posix.join(os.tmpdir(), 'payload-env.txt')

export type Env = 'production' | 'development'

;(global as any).env = undefined

export const getEnv = (): Env => {
  if ((global as any).env) {
    return (global as any).env
  } else if (existsSync(tmpFile)) {
    ;(global as any).env = readFileSync(tmpFile, 'utf8') as Env
    return (global as any).env
  } else {
    ;(global as any).env = 'development'
    return (global as any).env
  }
}

export const setEnv = (newEnv: Env) => {
  writeFileSync(tmpFile, newEnv)
  ;(global as any).env = newEnv
}
