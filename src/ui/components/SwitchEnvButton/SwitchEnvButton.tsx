import type { FC } from 'react'
import { SwitchEnvButtonClient } from '../SwitchEnvButtonClient/SwitchEnvButtonClient'
import { getEnv } from '../../../lib/env'
import type { QuickSwitchArgs } from '../../../types'

export type SwitchEnvButtonProps = {
  quickSwitch: QuickSwitchArgs
}

export const SwitchEnvButton: FC<SwitchEnvButtonProps> = async ({ quickSwitch }) => {
  const env = getEnv()
  return <SwitchEnvButtonClient env={env} quickSwitch={quickSwitch} />
}

export default SwitchEnvButton
