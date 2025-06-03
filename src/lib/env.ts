import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'
import type { Env, GetEnv, SetEnv } from '../types'
import { switchEnvGlobalSlug } from '../globals/switchEnvGlobal.js'

const tmpFile = path.posix.join(os.tmpdir(), 'payload-env.txt')

declare global {
  var env: Env | undefined
}

global.env = undefined

const isDev = process.env.NODE_ENV === 'development'

export const getEnv: GetEnv = async (payload) => {
  if (global.env) {
    return global.env
  } else if (isDev && existsSync(tmpFile)) {
    global.env = readFileSync(tmpFile, 'utf8') as Env
    return global.env
  } else {
    const global = await payload.findGlobal({
      slug: switchEnvGlobalSlug,
      depth: 0,
    })
    return global?.env ?? 'development'
  }
}

export const setEnv: SetEnv = async (newEnv, payload) => {
  global.env = newEnv
  if (isDev) {
    writeFileSync(tmpFile, newEnv)
  } else {
    await payload.updateGlobal({
      slug: switchEnvGlobalSlug,
      data: {
        env: newEnv,
      },
    })
  }
}
