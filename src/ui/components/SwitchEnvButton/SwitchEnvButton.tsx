import { FC } from 'react'
import { SwitchEnvButtonClient } from '../SwitchEnvButtonClient/SwitchEnvButtonClient'
import { getEnv } from '../../../lib/env'

export type SwitchEnvButtonProps = {
  quickSwitch: boolean
}

export const SwitchEnvButton: FC<SwitchEnvButtonProps> = async ({ quickSwitch }) => {
  const env = getEnv()
  console.log(`---------- ${env} ----------`)
  return <SwitchEnvButtonClient env={env} quickSwitch={quickSwitch} />
}

export default SwitchEnvButton
