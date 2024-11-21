'use client'
import { Button, Modal, useConfig, useModal, CheckboxInput, Tooltip, toast } from '@payloadcms/ui'
import { type FC, useEffect, useRef, useState } from 'react'
import { useMutation } from '../../hooks/useMutation'
import { switchEnvGlobalSlug } from '../../../lib/slugs'
import type { Env } from '../../../lib/env'
import './SwitchEnvButtonClient.scss'
import { useRouter } from 'next/navigation'
import {
  type SwitchEndpointInput,
  type SwitchEndpointOutput,
} from '../../../lib/api-endpoints/switch'
import { InfoIcon, LoadingSpinnerIcon, SwitchIcon, WarningIcon } from './icons'

const baseClass = 'switch-env'

export interface SwitchEnvButtonClientProps {
  env: Env
  quickSwitch: boolean
}

export const SwitchEnvButtonClient: FC<SwitchEnvButtonClientProps> = ({ env, quickSwitch }) => {
  const {
    config: {
      serverURL,
      routes: { api: apiRoute },
    },
  } = useConfig()

  const { openModal, closeModal } = useModal()
  const router = useRouter()
  const hasRefreshed = useRef(false)
  const [buttonLoading, setButtonLoading] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hasRefreshed.current) {
      hasRefreshed.current = true
      closeModal('switch-env')
      setButtonLoading(false)
    }
  })

  const baseUrl = `${serverURL}${apiRoute}/globals/${switchEnvGlobalSlug}`
  const { mutate } = useMutation<SwitchEndpointInput, SwitchEndpointOutput>(`${baseUrl}/switch`, {
    onSuccess: (data) => {
      if (data.success) {
        setTimeout(() => {
          router.refresh()
          hasRefreshed.current = false
        }, 10)
      }
    },
    onError: (error) => {
      const message = error?.message || 'An unknown error occurred'
      toast.error(message)
      setButtonLoading(false)
    },
  })
  const targetEnv = env === 'production' ? 'Development' : 'Production'
  const [copyDatabase, setCopyDatabase] = useState(quickSwitch)
  const [showCopyDatabaseTooltip, setShowCopyDatabaseTooltip] = useState(false)

  return (
    <div className={`${baseClass}`}>
      <button
        className={`${baseClass}__btn-switch`}
        onClick={() => {
          if (quickSwitch) {
            mutate({
              copyDatabase,
            })
            setButtonLoading(true)
          } else {
            openModal('switch-env')
          }
        }}
      >
        {buttonLoading && quickSwitch ? (
          <LoadingSpinnerIcon />
        ) : (
          <SwitchIcon className={`${baseClass}__btn-switch__icon`} />
        )}
      </button>
      <Modal slug="switch-env" className={`${baseClass}__modal`}>
        <div className={`${baseClass}__modal-close`} onClick={() => closeModal('switch-env')}></div>
        <div className={`${baseClass}__modal-content`}>
          <h4>Switch to {targetEnv}</h4>
          {targetEnv == 'Development' && (
            <div className={`${baseClass}__modal-content-checkbox-wrapper`}>
              <div className={`${baseClass}__modal-content-checkbox-wrapper-icon-wrapper`}>
                <CheckboxInput
                  id="copy-database"
                  name="copy-database"
                  label="Copy database?"
                  onToggle={() => setCopyDatabase(!copyDatabase)}
                  checked={copyDatabase}
                />
                <div className={`${baseClass}__modal-content-checkbox-wrapper-icon-tooltip`}>
                  <InfoIcon
                    width="20"
                    height="20"
                    onMouseEnter={() => setShowCopyDatabaseTooltip(true)}
                    onMouseLeave={() => setShowCopyDatabaseTooltip(false)}
                  />
                  <Tooltip show={showCopyDatabaseTooltip}>
                    This will overwrite your local database with the production database
                  </Tooltip>
                </div>
              </div>
            </div>
          )}
          <Button
            onClick={() => {
              mutate({
                copyDatabase,
              })
              setButtonLoading(true)
            }}
          >
            {buttonLoading ? <LoadingSpinnerIcon /> : 'Switch'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
