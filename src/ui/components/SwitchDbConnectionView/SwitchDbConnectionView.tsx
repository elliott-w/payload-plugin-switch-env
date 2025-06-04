import type { FC } from 'react'
import type { AdminViewServerProps, Payload } from 'payload'
import type { GetDatabaseAdapter } from '../../../lib/db/getDbaFunction'
import { switchDbConnection } from '../../../lib/db/switchDbConnection'
import { setEnv } from '../../../lib/env'
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
    redirect(payload.config.routes.admin)
  }
  let env = searchParams.env
  if (!isEnv(env)) {
    const errorMsg = `Query parameter 'env' has invalid value '${env}' in SwitchDbConnectionView`
    payload.logger.error(errorMsg)
    return <p>{errorMsg}</p>
  }
  await setEnv(env, payload)
  await switchDbConnection(payload, env, getDatabaseAdapter)
  await setEnv(env, payload)
  return <p>Successfully connected to {env} database</p>
}
