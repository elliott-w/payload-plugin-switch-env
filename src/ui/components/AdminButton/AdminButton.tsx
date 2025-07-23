import type { FC } from 'react'
import type { ButtonMode, GetEnv, QuickSwitchArgs } from '../../../types'
import type { Payload } from 'payload'
import { SwitchEnvButtonClient } from '../SwitchEnvButtonClient/SwitchEnvButtonClient'
import { CopyDbButtonClient } from '../CopyDbButtonClient/CopyDbButtonClient'

export type AdminButtonProps = {
  mode: ButtonMode
  payload: Payload
  quickSwitch: QuickSwitchArgs
  getEnv: GetEnv
}

export const AdminButton: FC<AdminButtonProps> = async ({ mode, payload, quickSwitch, getEnv }) => {
  const env = await getEnv(payload)
  if (mode === 'copy') {
    if (env === 'production') {
      // If we somehow got into production mode, don't show the button
      return null
    } else {
      return <CopyDbButtonClient />
    }
  }
  return <SwitchEnvButtonClient env={env} quickSwitch={quickSwitch} />
}

export default AdminButton
