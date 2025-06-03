import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'
import type { Env, GetEnv, SetEnv } from '../types'

const tmpFile = path.posix.join(os.tmpdir(), 'payload-env.txt')

declare global {
  var env: Env | undefined
}

global.env = undefined

export const getEnv: GetEnv = () => {
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

export const setEnv: SetEnv = (newEnv) => {
  writeFileSync(tmpFile, newEnv)
  global.env = newEnv
}
