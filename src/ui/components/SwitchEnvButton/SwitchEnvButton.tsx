import type { FC } from 'react'
import { SwitchEnvButtonClient } from '../SwitchEnvButtonClient/SwitchEnvButtonClient'
import type { GetEnv, QuickSwitchArgs } from '../../../types'

export type SwitchEnvButtonProps = {
  quickSwitch: QuickSwitchArgs
  getEnv: GetEnv
}

export const SwitchEnvButton: FC<SwitchEnvButtonProps> = async ({ quickSwitch, getEnv }) => {
  const env = await getEnv()
  return <SwitchEnvButtonClient env={env} quickSwitch={quickSwitch} />
}

export default SwitchEnvButton
