'use client'

import React, { createContext, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { ModalConfig, ModalContextProps, ModalPriority } from './ModalTypes'
import { 
  FocusTrap,
  ConfirmationModal, 
  ProcessingModal, 
  SuccessModal, 
  ErrorModal, 
  WarningModal, 
  TransactionModal, 
  SystemModal 
} from './ModalComponents'

export const ModalContext = createContext<ModalContextProps | null>(null)

// Helper to assign numeric weight to priority levels for sorting
const PRIORITY_WEIGHTS: Record<ModalPriority, number> = {
  'P0': 4, // Critical / Security
  'P1': 3, // Blocking
  'P2': 2, // Important workflow
  'P3': 1, // Informational
}

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<ModalConfig[]>([])
  const [activeModal, setActiveModal] = useState<ModalConfig | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync active modal with the highest priority item in queue
  useEffect(() => {
    if (queue.length > 0) {
      // Sort queue by priority weight (descending)
      const sorted = [...queue].sort((a, b) => {
        const weightA = PRIORITY_WEIGHTS[a.priority] || 0
        const weightB = PRIORITY_WEIGHTS[b.priority] || 0
        return weightB - weightA
      })
      
      // Always sync activeModal to the latest version of the top-priority item
      // This ensures step/content updates are reflected even when the ID stays the same
      const top = sorted[0]
      if (!activeModal || activeModal.id !== top.id || activeModal !== top) {
        setActiveModal(top)
        setIsClosing(false)
      }
    } else {
      // If queue is empty, trigger exit animation first
      if (activeModal) {
        setIsClosing(true)
        const timer = setTimeout(() => {
          setActiveModal(null)
          setIsClosing(false)
        }, 200) // matches transition duration
        return () => clearTimeout(timer)
      }
    }
  }, [queue]) // Only depend on queue, not activeModal — avoids infinite loops

  const openModal = useCallback((config: Omit<ModalConfig, 'id'> & { id?: string }): string => {
    const id = config.id || `modal_${Math.random().toString(36).substr(2, 9)}`
    
    setQueue(prev => {
      // 1. If a modal with the same ID already exists, update/merge it
      const hasMatchingId = prev.some(item => item.id === id)
      if (hasMatchingId) {
        return prev.map(item => item.id === id ? { ...item, ...config, id } : item)
      }
      
      // 2. Deduplicate: Prevent adding if another modal has the same title & type
      const exists = prev.some(item => item.title === config.title && item.type === config.type)
      if (exists) {
        return prev
      }
      
      const newModal: ModalConfig = {
        ...config,
        id,
        priority: config.priority || 'P2',
      }
      return [...prev, newModal]
    })
    
    return id
  }, [])

  const closeModal = useCallback((id?: string) => {
    setQueue(prev => {
      if (prev.length === 0) return prev
      
      if (id) {
        // Close specific modal by ID
        return prev.filter(item => item.id !== id)
      }
      
      // No ID passed: close the highest-priority (currently displayed) modal
      const sorted = [...prev].sort((a, b) => {
        const weightA = PRIORITY_WEIGHTS[a.priority] || 0
        const weightB = PRIORITY_WEIGHTS[b.priority] || 0
        return weightB - weightA
      })
      const topId = sorted[0]?.id
      if (!topId) return prev
      
      return prev.filter(item => item.id !== topId)
    })
  }, []) // No dependencies — always works with latest queue via setState callback

  const replaceModal = useCallback((config: Omit<ModalConfig, 'id'> & { id?: string }): string => {
    const newId = config.id || `modal_${Math.random().toString(36).substr(2, 9)}`
    
    setQueue(prev => {
      const newModal: ModalConfig = {
        ...config,
        id: newId,
        priority: config.priority || 'P2',
      }
      
      // If active modal exists, replace it
      if (activeModal) {
        return prev.map(item => item.id === activeModal.id ? newModal : item)
      }
      
      return [...prev, newModal]
    })
    
    return newId
  }, [activeModal])

  const clearQueue = useCallback(() => {
    setQueue([])
  }, [])

  // Auto-close handler for modals with autoCloseDelay
  useEffect(() => {
    if (activeModal?.autoCloseDelay && activeModal.autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        closeModal(activeModal.id)
      }, activeModal.autoCloseDelay)
      return () => clearTimeout(timer)
    }
  }, [activeModal, closeModal])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !activeModal?.preventBackdropClose) {
      closeModal()
    }
  }

  // Render specific modal internal variant
  const renderModalContent = (modal: ModalConfig) => {
    switch (modal.type) {
      case 'confirm':
        return <ConfirmationModal modal={modal} onClose={() => closeModal(modal.id)} />
      case 'processing':
        return <ProcessingModal modal={modal} />
      case 'success':
        return <SuccessModal modal={modal} onClose={() => closeModal(modal.id)} />
      case 'error':
        return <ErrorModal modal={modal} onClose={() => closeModal(modal.id)} />
      case 'warning':
        return <WarningModal modal={modal} onClose={() => closeModal(modal.id)} />
      case 'transaction':
        return <TransactionModal modal={modal} onClose={() => closeModal(modal.id)} />
      case 'system':
        return <SystemModal modal={modal} onClose={() => closeModal(modal.id)} />
      case 'custom':
      default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: '0 0 10px 0' }}>{modal.title}</h3>
            {modal.description && (
              <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                {modal.description}
              </p>
            )}
            {modal.content}
          </div>
        )
    }
  }

  return (
    <ModalContext.Provider value={{ activeModal, modalQueue: queue, openModal, closeModal, replaceModal, clearQueue }}>
      {children}
      
      {mounted && activeModal && createPortal(
        <div 
          onClick={handleBackdropClick}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
            opacity: isClosing ? 0 : 1,
            transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Keyframe Injector */}
          <style>{`
            @keyframes modal-scale-in {
              from { transform: scale(0.96); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            .jobchain-modal-box {
              animation: modal-scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            @media (prefers-reduced-motion: reduce) {
              .jobchain-modal-box {
                animation: none !important;
              }
            }
          `}</style>

          <div 
            className="jobchain-modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            style={{
              background: '#0E1015',
              border: '1px solid var(--warp-border)',
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: activeModal.type === 'system' ? 520 : 440,
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.8), 0 0 50px rgba(143, 118, 255, 0.03)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <FocusTrap 
              onClose={closeModal} 
              preventEsc={activeModal.preventEscClose}
              autoFocus={activeModal.type !== 'processing' && activeModal.type !== 'transaction'}
            >
              {/* Optional Close Button */}
              {activeModal.showCloseButton !== false && !isClosing && (
                <button
                  onClick={() => closeModal(activeModal.id)}
                  aria-label="Close dialog"
                  style={{
                    position: 'absolute',
                    top: 18,
                    right: 18,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--warp-border)',
                    borderRadius: '50%',
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--warp-muted)',
                    transition: 'all 0.2s ease',
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--warp-muted)'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                  }}
                >
                  <X size={13} />
                </button>
              )}

              {/* Render dynamic content */}
              <div id="modal-title">
                {renderModalContent(activeModal)}
              </div>
            </FocusTrap>
          </div>
        </div>,
        document.body
      )}
    </ModalContext.Provider>
  )
}
