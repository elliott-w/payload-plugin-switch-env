import { revalidateTag, unstable_cache } from 'next/cache'
import type { Env, GetEnv, SetEnv } from '@elliott-w/payload-plugin-switch-env'

declare global {
  var env: Env | undefined
}

global.env = undefined

const getEnvCache = unstable_cache(async () => global.env ?? 'development', [], {
  tags: ['switch-env'],
})

const getEnv: GetEnv = async () => global.env ?? (await getEnvCache())

const setEnv: SetEnv = async (newEnv) => {
  global.env = newEnv
  revalidateTag('switch-env')
  await envCache.getEnv()
}

export const envCache = {
  getEnv,
  setEnv,
}
