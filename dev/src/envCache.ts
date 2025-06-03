import { revalidateTag, unstable_cache } from 'next/cache'
import type { Env, GetEnv, SetEnv } from '@elliott-w/payload-plugin-switch-env'
import type { Payload } from 'payload'

declare global {
  var env: Env | undefined
}

global.env = undefined

const getEnvCache = unstable_cache(async (getEnv: () => Promise<Env>) => await getEnv(), [], {
  tags: ['switch-env'],
})

const getEnvFromDb = (payload: Payload) => () =>
  payload
    .findGlobal({
      slug: 'switchEnv',
    })
    .then((g) => g.env)

const getEnv: GetEnv = async (payload) => {
  if (global.env) {
    return global.env
  } else {
    return await getEnvCache(getEnvFromDb(payload))
  }
}

const setEnv: SetEnv = async (newEnv, payload) => {
  global.env = newEnv
  await payload.updateGlobal({
    slug: 'switchEnv',
    data: {
      env: newEnv,
    },
  })
  revalidateTag('switch-env')
  await getEnv(payload)
}

export const envCache = {
  getEnv,
  setEnv,
}
