import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'

const tmpFile = path.posix.join(os.tmpdir(), 'payload-env.txt')

export type Env = 'production' | 'development'

declare global {
  var env: Env | undefined
}

global.env = undefined

export const getEnv = (): Env => {
  if (global.env) {
    return global.env
  } else if (existsSync(tmpFile)) {
    global.env = readFileSync(tmpFile, 'utf8') as Env
    return global.env
  } else {
    global.env = 'development'
    return global.env
  }
}

export const setEnv = (newEnv: Env) => {
  writeFileSync(tmpFile, newEnv)
  global.env = newEnv
}
