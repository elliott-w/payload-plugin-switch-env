import { FC } from 'react'
import SwitchEnvButtonClient from '../SwitchEnvButtonClient/SwitchEnvButton.client'
import { getEnv } from '../../../lib/env'

export type SwitchEnvButtonProps = {
  quickSwitch: boolean
}

export const SwitchEnvButton: FC<SwitchEnvButtonProps> = async ({ quickSwitch }) => {
  const env = getEnv()
  return <SwitchEnvButtonClient env={env} quickSwitch={quickSwitch} />
}

export default SwitchEnvButton
