import type { FC } from 'react'
import type { AdminViewServerProps } from 'payload'
import type { GetDatabaseAdapter } from '../../../lib/db/getDbaFunction'
import { switchDbConnection } from '../../../lib/db/switchDbConnection'
import { setEnvCache } from '../../../lib/env'
import { redirect } from 'next/navigation'

export type SwitchDbConnectionViewProps = AdminViewServerProps & {
  getDatabaseAdapter: GetDatabaseAdapter
}

const isEnv = (env: string | string[] | undefined): env is 'production' | 'development' => {
  return typeof env === 'string' && (env === 'production' || env === 'development')
}

export const SwitchDbConnectionView: FC<SwitchDbConnectionViewProps> = async ({
  payload,
  getDatabaseAdapter,
  searchParams,
}) => {
  if (!searchParams || !searchParams.secret || searchParams.secret !== payload.config.secret) {
    payload.logger.error(`Invalid secret '${searchParams?.secret}' in SwitchDbConnectionView`)
    // If not authorized, redirect to /admin (Payload's default behaviour if route does not exist)
    redirect(payload.config.routes.admin)
  }
  const env = searchParams.env
  if (!isEnv(env)) {
    const errorMsg = `Query parameter 'env' has invalid value '${env}' in SwitchDbConnectionView`
    payload.logger.error(errorMsg)
    return <p>{errorMsg}</p>
  }
  setEnvCache(env)
  await switchDbConnection(payload, env, getDatabaseAdapter)
  return <p>Successfully connected to {env} database</p>
}
