import type { FC } from 'react'
import { SwitchEnvButtonClient } from '../SwitchEnvButtonClient/SwitchEnvButtonClient'
import type { GetEnv, QuickSwitchArgs } from '../../../types'
import type { Payload } from 'payload'

export type SwitchEnvButtonProps = {
  payload: Payload
  quickSwitch: QuickSwitchArgs
  getEnv: GetEnv
}

export const SwitchEnvButton: FC<SwitchEnvButtonProps> = async ({
  payload,
  quickSwitch,
  getEnv,
}) => {
  const env = await getEnv(payload)
  return <SwitchEnvButtonClient env={env} quickSwitch={quickSwitch} />
}

export default SwitchEnvButton
