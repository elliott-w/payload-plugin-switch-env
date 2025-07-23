'use client'
import { Button, Modal, useModal, CheckboxInput, Tooltip, useConfig, toast } from '@payloadcms/ui'
import { type FC, useEffect, useRef, useState } from 'react'
import { useMutation } from '../../hooks/useMutation'
import './CopyDbButtonClient.scss'
import { useRouter } from 'next/navigation'
import { LoadingSpinnerIcon } from '../SwitchEnvButtonClient/icons'
import type { CopyEndpointInput, CopyEndpointOutput } from '../../../lib/api-endpoints/copy'
import { CopyIcon } from './icons'

const baseClass = 'copy-db'

export interface CopyDbButtonClientProps {}

export const CopyDbButtonClient: FC<CopyDbButtonClientProps> = () => {
  const {
    config: {
      serverURL,
      routes: { api: apiRoute },
    },
  } = useConfig()

  const router = useRouter()
  const hasRefreshed = useRef(false)
  const [buttonLoading, setButtonLoading] = useState(false)

  const { openModal, closeModal } = useModal()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hasRefreshed.current) {
      hasRefreshed.current = true
      closeModal('copy-db')
      setButtonLoading(false)
    }
  })

  const url = `${serverURL}${apiRoute}/copy-db`
  const { mutate } = useMutation<CopyEndpointInput, CopyEndpointOutput>(url, {
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

  return (
    <div className={`${baseClass}`}>
      <button className={`${baseClass}__btn-copy`} onClick={() => openModal('copy-db')}>
        {buttonLoading ? (
          <LoadingSpinnerIcon />
        ) : (
          <CopyIcon className={`${baseClass}__btn-copy__icon`} />
        )}
      </button>
      <Modal slug="copy-db" className={`${baseClass}__modal`}>
        <div className={`${baseClass}__modal-close`} onClick={() => closeModal('copy-db')}></div>
        <div className={`${baseClass}__modal-content`}>
          <h4>Overwrite local database with production?</h4>
          <p className={`${baseClass}__modal-content__description`}>
            The local database is whatever the <code>url</code> is in <code>developmentArgs</code>{' '}
            in the plugin config.
          </p>
          <Button
            onClick={() => {
              mutate({})
              setButtonLoading(true)
            }}
          >
            {buttonLoading ? <LoadingSpinnerIcon /> : 'Copy & Overwrite'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
