import { FC } from 'react'
import { getEnv } from '../../../lib/env'
import './DangerBar.scss'
import { WarningIcon } from '../SwitchEnvButtonClient/icons'

export const DangerBar: FC = async () => {
  if (!(process.env.NODE_ENV === 'development' && getEnv() === 'production')) {
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
