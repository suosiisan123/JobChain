'use client'

import { useContext } from 'react'
import { ModalContext } from '../components/modals/ModalProvider'
import { ModalConfig, ModalStep } from '../components/modals/ModalTypes'
import { mapRawError } from '../components/modals/ErrorMappingEngine'

export function useModal() {
  const context = useContext(ModalContext)
  
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }

  const { activeModal, modalQueue, openModal, closeModal, replaceModal, clearQueue } = context

  // Helper: Confirmation Dialog
  const confirm = (options: {
    title: string
    description?: string
    variant?: 'neutral' | 'warning' | 'destructive'
    confirmText?: string
    cancelText?: string
    onConfirm?: () => void | Promise<void>
    onCancel?: () => void
    priority?: 'P0' | 'P1' | 'P2' | 'P3'
  }) => {
    return openModal({
      type: 'confirm',
      priority: options.priority || 'P2',
      title: options.title,
      description: options.description,
      variant: options.variant || 'neutral',
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
    })
  }

  // Helper: Long-running task processing
  const showProcessing = (options: {
    title: string
    description?: string
    progress?: number
    estimatedTime?: string
    steps?: ModalStep[]
    currentStepIndex?: number
    priority?: 'P0' | 'P1' | 'P2' | 'P3'
    preventBackdropClose?: boolean
    preventEscClose?: boolean
  }) => {
    return openModal({
      type: 'processing',
      priority: options.priority || 'P2',
      title: options.title,
      description: options.description,
      progress: options.progress,
      estimatedTime: options.estimatedTime,
      steps: options.steps,
      currentStepIndex: options.currentStepIndex,
      preventBackdropClose: options.preventBackdropClose ?? true,
      preventEscClose: options.preventEscClose ?? true,
      showCloseButton: false
    })
  }

  // Helper: Success Celebration Dialog
  const showSuccess = (options: {
    title: string
    description?: string
    txHash?: string
    explorerLink?: string
    autoCloseDelay?: number
    onCloseClick?: () => void
    priority?: 'P0' | 'P1' | 'P2' | 'P3'
  }) => {
    return openModal({
      type: 'success',
      priority: options.priority || 'P2',
      title: options.title,
      description: options.description,
      txHash: options.txHash,
      explorerLink: options.explorerLink,
      autoCloseDelay: options.autoCloseDelay,
      onCancel: options.onCloseClick,
    })
  }

  // Helper: Error alert with automatic raw-to-domain mapping
  const showError = (options: {
    error: any
    title?: string
    description?: string
    retryAction?: () => void | Promise<void>
    priority?: 'P0' | 'P1' | 'P2' | 'P3'
  }) => {
    const domainErr = mapRawError(options.error)
    
    return openModal({
      type: 'error',
      priority: options.priority || 'P1', // default P1 blocking for errors
      title: options.title || domainErr.title,
      description: options.description || domainErr.message,
      retryAction: domainErr.retryable ? options.retryAction : undefined,
    })
  }

  // Helper: Important risk warning dialog
  const showWarning = (options: {
    title: string
    description?: string
    confirmText?: string
    onConfirm?: () => void | Promise<void>
    priority?: 'P0' | 'P1' | 'P2' | 'P3'
  }) => {
    return openModal({
      type: 'warning',
      priority: options.priority || 'P1',
      title: options.title,
      description: options.description,
      confirmText: options.confirmText,
      onConfirm: options.onConfirm,
    })
  }

  // Helper: Web3 Transaction Lifecycle
  const showTransaction = (options: {
    title: string
    description?: string
    txStatus?: 'preparing' | 'awaiting_signature' | 'pending' | 'confirming' | 'success' | 'failed' | 'rejected' | 'timeout'
    txHash?: string
    explorerLink?: string
    retryAction?: () => void | Promise<void>
    priority?: 'P0' | 'P1' | 'P2' | 'P3'
  }) => {
    return openModal({
      type: 'transaction',
      priority: options.priority || 'P1',
      title: options.title,
      description: options.description,
      txStatus: options.txStatus,
      txHash: options.txHash,
      explorerLink: options.explorerLink,
      retryAction: options.retryAction,
      preventBackdropClose: true,
      preventEscClose: true,
      showCloseButton: options.txStatus === 'success' || options.txStatus === 'failed' || options.txStatus === 'rejected'
    })
  }

  // Helper: Global critical Announcements/Migrations
  const showSystem = (options: {
    title: string
    description?: string
    content?: React.ReactNode
    preventBackdropClose?: boolean
    priority?: 'P0' | 'P1' | 'P2' | 'P3'
  }) => {
    return openModal({
      type: 'system',
      priority: options.priority || 'P0', // Critical P0
      title: options.title,
      description: options.description,
      content: options.content,
      preventBackdropClose: options.preventBackdropClose ?? true,
      preventEscClose: options.preventBackdropClose ?? true,
      showCloseButton: !options.preventBackdropClose
    })
  }

  return {
    activeModal,
    modalQueue,
    openModal,
    closeModal,
    replaceModal,
    clearQueue,
    confirm,
    showProcessing,
    showSuccess,
    showError,
    showWarning,
    showTransaction,
    showSystem
  }
}
