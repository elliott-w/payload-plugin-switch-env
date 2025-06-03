import { FC } from 'react'
import './DangerBar.scss'
import { WarningIcon } from '../SwitchEnvButtonClient/icons'
import type { GetEnv } from '../../../types'
import type { Payload } from 'payload'

export interface DangerBarProps {
  payload: Payload
  getEnv: GetEnv
}

export const DangerBar: FC<DangerBarProps> = async ({ payload, getEnv }) => {
  const env = await getEnv(payload)
  if (env === 'development') {
    return null
  }

  return (
    <div className="danger-bar">
      <WarningIcon className="danger-bar__icon" />
      <span className="danger-bar__text"> You are editing in a production environment</span>
    </div>
  )
}

export default DangerBar
