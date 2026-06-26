import React from 'react'

export type ModalPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type ModalType = 
  | 'confirm' 
  | 'processing' 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'transaction' 
  | 'system'
  | 'custom'

export interface ModalStep {
  label: string
  status: 'pending' | 'active' | 'done' | 'failed'
}

export interface ModalConfig {
  id: string
  type: ModalType
  priority: ModalPriority
  title: string
  description?: string
  content?: React.ReactNode
  
  // Buttons & CTAs
  variant?: 'neutral' | 'warning' | 'destructive'
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
  
  // Loading & Progress
  progress?: number // 0 to 100
  estimatedTime?: string
  steps?: ModalStep[]
  currentStepIndex?: number
  
  // Transaction Info (Web3 specific)
  txStatus?: 'preparing' | 'awaiting_signature' | 'pending' | 'confirming' | 'success' | 'failed' | 'rejected' | 'timeout'
  txHash?: string
  explorerLink?: string
  retryAction?: () => void | Promise<void>
  
  // Success Options
  autoCloseDelay?: number
  
  // Behavior Settings
  preventBackdropClose?: boolean
  preventEscClose?: boolean
  showCloseButton?: boolean
}

export interface ModalContextProps {
  activeModal: ModalConfig | null
  modalQueue: ModalConfig[]
  openModal: (config: Omit<ModalConfig, 'id'> & { id?: string }) => string
  closeModal: (id?: string) => void
  replaceModal: (config: Omit<ModalConfig, 'id'> & { id?: string }) => string
  clearQueue: () => void
}
