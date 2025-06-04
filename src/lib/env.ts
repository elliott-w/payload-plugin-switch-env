import type { Env, GetEnv, SetEnv } from '../types'
import { switchEnvGlobalSlug } from '../globals/switchEnvGlobal.js'

declare global {
  var env: Env | undefined
}

global.env = undefined

export const getEnv: GetEnv = async (payload) => {
  if (typeof global.env !== 'undefined') {
    return global.env
  } else {
    const switchEnvGlobal = await payload.findGlobal({
      slug: switchEnvGlobalSlug,
      depth: 0,
    })
    const env = switchEnvGlobal?.env ?? 'development'
    setEnvCache(env)
    return env
  }
}

export const setEnv: SetEnv = async (newEnv, payload) => {
  setEnvCache(newEnv)
  await payload.updateGlobal({
    slug: switchEnvGlobalSlug,
    data: {
      env: newEnv,
    },
  })
}

export const setEnvCache = (newEnv: Env) => {
  global.env = newEnv
}
