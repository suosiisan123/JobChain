'use client'

import React, { useEffect, useRef } from 'react'
import { 
  X, AlertTriangle, CheckCircle, Info, ShieldAlert, 
  Cpu, RotateCw, Loader2, ArrowRight, ExternalLink, RefreshCw 
} from 'lucide-react'
import { ModalConfig } from './ModalTypes'

// Accessibilty Focus Trap Wrapper
interface FocusTrapProps {
  children: React.ReactNode
  onClose: () => void
  preventEsc?: boolean
  autoFocus?: boolean
}

export const FocusTrap: React.FC<FocusTrapProps> = ({ children, onClose, preventEsc, autoFocus = true }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const hasInitializedRef = useRef(false)
  // Use stable refs for callbacks so the keydown effect doesn't re-run on every modal content update
  const onCloseRef = useRef(onClose)
  const preventEscRef = useRef(preventEsc)
  onCloseRef.current = onClose
  preventEscRef.current = preventEsc

  // Focus steal — runs ONCE on mount only
  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    if (typeof document !== 'undefined') {
      previousFocusRef.current = document.activeElement as HTMLElement
    }

    if (autoFocus) {
      const container = containerRef.current
      if (!container) return

      const focusableSelector = 'button, [href], input, select, textarea, [tabindex="0"]'
      const focusableElements = container.querySelectorAll(focusableSelector)
      
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus()
      }
    }

    return () => {
      // Restore focus only on true unmount
      if (autoFocus && previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [autoFocus])

  // Keyboard trap — uses stable refs, never re-runs
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex="0"]'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const currentElements = container.querySelectorAll(focusableSelector)
        if (currentElements.length === 0) return

        const first = currentElements[0] as HTMLElement
        const last = currentElements[currentElements.length - 1] as HTMLElement

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus()
            e.preventDefault()
          }
        } else {
          if (document.activeElement === last) {
            first.focus()
            e.preventDefault()
          }
        }
      }

      if (e.key === 'Escape' && !preventEscRef.current) {
        onCloseRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={containerRef} style={{ outline: 'none' }}>
      {children}
    </div>
  )
}

// ── 1. CONFIRMATION MODAL ──
export const ConfirmationModal: React.FC<{ modal: ModalConfig; onClose: () => void }> = ({ modal, onClose }) => {
  const isDestructive = modal.variant === 'destructive'
  const isWarning = modal.variant === 'warning'
  
  let headerColor = 'var(--warp-primary)'
  let accentBg = 'rgba(143, 118, 255, 0.08)'
  let accentBorder = 'rgba(143, 118, 255, 0.2)'
  let actionColor = 'var(--warp-primary)'
  let actionText = '#000000'
  
  if (isDestructive) {
    headerColor = 'var(--warp-danger)'
    accentBg = 'rgba(239, 68, 68, 0.08)'
    accentBorder = 'rgba(239, 68, 68, 0.2)'
    actionColor = 'var(--warp-danger)'
    actionText = '#ffffff'
  } else if (isWarning) {
    headerColor = 'var(--warp-warning)'
    accentBg = 'rgba(255, 163, 26, 0.08)'
    accentBorder = 'rgba(255, 163, 26, 0.2)'
    actionColor = 'var(--warp-warning)'
    actionText = '#000000'
  }

  const [confirming, setConfirming] = React.useState(false)

  const handleConfirm = async () => {
    if (modal.onConfirm) {
      setConfirming(true)
      try {
        await modal.onConfirm()
      } catch (e) {
        console.error('Modal Action Failed:', e)
      } finally {
        setConfirming(false)
        onClose()
      }
    } else {
      onClose()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          background: accentBg,
          border: `1px solid ${accentBorder}`,
          borderRadius: 8,
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {isDestructive || isWarning ? (
            <AlertTriangle size={18} style={{ color: headerColor }} />
          ) : (
            <Info size={18} style={{ color: headerColor }} />
          )}
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', margin: 0 }}>{modal.title}</h3>
          <span style={{ fontSize: 9.5, color: 'var(--warp-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Confirmation Required
          </span>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
        {modal.description || 'Are you sure you want to perform this action? This operation cannot be undone.'}
      </p>

      {modal.content}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => {
            if (modal.onCancel) modal.onCancel()
            onClose()
          }}
          disabled={confirming}
          className="warp-btn secondary"
          style={{ flex: 1, padding: '10px 14px' }}
        >
          {modal.cancelText || 'Cancel'}
        </button>
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="warp-btn"
          style={{
            flex: 1,
            background: actionColor,
            color: actionText,
            fontWeight: 'bold',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          {confirming && <Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />}
          {confirming ? 'Processing...' : (modal.confirmText || 'Confirm')}
        </button>
      </div>
    </div>
  )
}

// ── 2. PROCESSING MODAL ──
export const ProcessingModal: React.FC<{ modal: ModalConfig }> = ({ modal }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px 0' }}>
      <div style={{ position: 'relative', width: 56, height: 56, marginBottom: 20 }}>
        {/* Spinner ring */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '3px solid rgba(143, 118, 255, 0.08)',
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '3px solid transparent',
          borderTopColor: 'var(--warp-primary)',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Cpu size={20} style={{ color: 'var(--warp-primary)', opacity: 0.8 }} />
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>{modal.title}</h3>
      <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: '0 0 20px 0', maxWidth: 320, lineHeight: 1.5 }}>
        {modal.description || 'Request submitted. Waiting for blockchain confirmation...'}
      </p>

      {/* Steps checklist */}
      {modal.steps && modal.steps.length > 0 && (
        <div style={{
          width: '100%',
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginBottom: 16,
          textAlign: 'left'
        }}>
          {modal.steps.map((step, idx) => {
            const isPending = step.status === 'pending'
            const isActive = step.status === 'active'
            const isDone = step.status === 'done'
            const isFailed = step.status === 'failed'

            let indicatorBg = 'rgba(255, 255, 255, 0.03)'
            let indicatorText = 'var(--warp-muted)'

            if (isActive) {
              indicatorBg = 'rgba(143, 118, 255, 0.08)'
              indicatorText = 'var(--warp-primary)'
            } else if (isDone) {
              indicatorBg = 'rgba(16, 185, 129, 0.08)'
              indicatorText = 'var(--warp-success)'
            } else if (isFailed) {
              indicatorBg = 'rgba(239, 68, 68, 0.08)'
              indicatorText = 'var(--warp-danger)'
            }

            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span style={{ color: isActive || isDone ? '#ffffff' : 'var(--warp-muted)', fontWeight: isActive ? 'bold' : 'normal' }}>
                  {step.label}
                </span>
                <div style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 9.5,
                  fontWeight: 'bold',
                  background: indicatorBg,
                  color: indicatorText,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  {isActive && <Loader2 size={10} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />}
                  {step.status.toUpperCase()}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Progress bar */}
      {modal.progress !== undefined && (
        <div style={{ width: '100%', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--warp-muted)', marginBottom: 4 }}>
            <span>Progress</span>
            <span>{Math.round(modal.progress)}%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${modal.progress}%`,
              background: 'var(--warp-primary)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {modal.estimatedTime && (
        <span style={{ fontSize: 10.5, color: 'var(--warp-muted)', fontFamily: 'monospace' }}>
          Estimated time: {modal.estimatedTime}
        </span>
      )}
    </div>
  )
}

// ── 3. SUCCESS MODAL ──
export const SuccessModal: React.FC<{ modal: ModalConfig; onClose: () => void }> = ({ modal, onClose }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px 0' }}>
      <div style={{
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '50%',
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        boxShadow: '0 0 16px rgba(16, 185, 129, 0.15)'
      }}>
        <CheckCircle size={22} style={{ color: 'var(--warp-success)' }} />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>{modal.title}</h3>
      <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: '0 0 20px 0', maxWidth: 340, lineHeight: 1.5 }}>
        {modal.description || 'The operation completed successfully.'}
      </p>

      {modal.content}

      {modal.txHash && (
        <div style={{
          width: '100%',
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 20,
          textAlign: 'left',
          fontFamily: 'monospace',
          fontSize: 10.5,
          color: 'var(--warp-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Tx: {modal.txHash.slice(0, 8)}...{modal.txHash.slice(-8)}</span>
          {modal.explorerLink && (
            <a 
              href={modal.explorerLink} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: 'var(--warp-primary)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
            >
              Verify <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      <button
        onClick={onClose}
        className="warp-btn"
        style={{ width: '100%', background: 'var(--warp-success)', color: '#000000', fontWeight: 'bold', padding: '10px 14px' }}
      >
        Done
      </button>
    </div>
  )
}

// ── 4. ERROR MODAL ──
export const ErrorModal: React.FC<{ modal: ModalConfig; onClose: () => void }> = ({ modal, onClose }) => {
  const [retrying, setRetrying] = React.useState(false)

  const handleRetry = async () => {
    if (modal.retryAction) {
      setRetrying(true)
      try {
        await modal.retryAction()
      } catch (e) {
        console.error('Retry Action Failed:', e)
      } finally {
        setRetrying(false)
        onClose()
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 8,
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ShieldAlert size={18} style={{ color: 'var(--warp-danger)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', margin: 0 }}>{modal.title}</h3>
          <span style={{ fontSize: 9.5, color: 'var(--warp-danger)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Action Blocked
          </span>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
        {modal.description || 'An unexpected failure occurred. Please review the details below and try again.'}
      </p>

      {modal.content}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onClose}
          disabled={retrying}
          className="warp-btn secondary"
          style={{ flex: 1, padding: '10px 14px' }}
        >
          Dismiss
        </button>
        {modal.retryAction && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="warp-btn"
            style={{
              flex: 1,
              background: '#ffffff',
              color: '#000000',
              fontWeight: 'bold',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            {retrying ? (
              <Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <RefreshCw size={12} />
            )}
            {retrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── 5. WARNING MODAL ──
export const WarningModal: React.FC<{ modal: ModalConfig; onClose: () => void }> = ({ modal, onClose }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          background: 'rgba(255, 163, 26, 0.08)',
          border: '1px solid rgba(255, 163, 26, 0.2)',
          borderRadius: 8,
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--warp-warning)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', margin: 0 }}>{modal.title}</h3>
          <span style={{ fontSize: 9.5, color: 'var(--warp-warning)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Action Risk Warning
          </span>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
        {modal.description || 'This action poses potential risks to your assets or credentials. Please acknowledge to proceed.'}
      </p>

      {modal.content}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onClose}
          className="warp-btn secondary"
          style={{ flex: 1, padding: '10px 14px' }}
        >
          Go Back
        </button>
        <button
          onClick={() => {
            if (modal.onConfirm) modal.onConfirm()
            onClose()
          }}
          className="warp-btn"
          style={{
            flex: 1,
            background: 'var(--warp-warning)',
            color: '#000000',
            fontWeight: 'bold',
            padding: '10px 14px'
          }}
        >
          {modal.confirmText || 'Acknowledge & Continue'}
        </button>
      </div>
    </div>
  )
}

// ── 6. TRANSACTION MODAL ──
export const TransactionModal: React.FC<{ modal: ModalConfig; onClose: () => void }> = ({ modal, onClose }) => {
  const status = modal.txStatus || 'preparing'
  
  let statusLabel = 'PREPARING'
  let statusColor = 'var(--warp-muted)'
  let isLoader = false
  
  if (status === 'awaiting_signature') {
    statusLabel = 'AWAITING SIGNATURE'
    statusColor = 'var(--warp-warning)'
    isLoader = true
  } else if (status === 'pending' || status === 'confirming') {
    statusLabel = 'CONFIRMING ON-CHAIN'
    statusColor = 'var(--warp-primary)'
    isLoader = true
  } else if (status === 'success') {
    statusLabel = 'SUCCESS'
    statusColor = 'var(--warp-success)'
  } else if (status === 'failed' || status === 'timeout') {
    statusLabel = 'FAILED'
    statusColor = 'var(--warp-danger)'
  } else if (status === 'rejected') {
    statusLabel = 'CANCELLED'
    statusColor = 'var(--warp-muted)'
  }

  const [retrying, setRetrying] = React.useState(false)
  const handleRetry = async () => {
    if (modal.retryAction) {
      setRetrying(true)
      try {
        await modal.retryAction()
      } catch (e) {
        console.error('Tx Retry Failed:', e)
      } finally {
        setRetrying(false)
        onClose()
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px 0' }}>
      <div style={{ position: 'relative', width: 56, height: 56, marginBottom: 20 }}>
        {isLoader ? (
          <>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid rgba(255, 255, 255, 0.03)',
            }} />
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: statusColor,
              animation: 'spin 1s linear infinite'
            }} />
          </>
        ) : (
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: status === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${status === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {status === 'success' ? (
              <CheckCircle size={22} style={{ color: 'var(--warp-success)' }} />
            ) : (
              <ShieldAlert size={22} style={{ color: 'var(--warp-danger)' }} />
            )}
          </div>
        )}
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>{modal.title}</h3>
      <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: '0 0 20px 0', maxWidth: 320, lineHeight: 1.5 }}>
        {modal.description || 'Blockchain transaction execution details.'}
      </p>

      {/* Transaction status panel */}
      <div style={{
        width: '100%',
        background: 'rgba(255, 255, 255, 0.01)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 20,
        textAlign: 'left'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 11.5 }}>
          <span style={{ color: 'var(--warp-muted)' }}>Status</span>
          <span style={{ color: statusColor, fontWeight: 'bold', letterSpacing: '0.02em' }}>{statusLabel}</span>
        </div>

        {modal.txHash && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5 }}>
            <span style={{ color: 'var(--warp-muted)' }}>Hash</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace' }}>
              <span style={{ color: '#ffffff' }}>{modal.txHash.slice(0, 6)}...{modal.txHash.slice(-6)}</span>
              {modal.explorerLink && (
                <a 
                  href={modal.explorerLink} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: 'var(--warp-primary)', display: 'flex', alignItems: 'center' }}
                >
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {status === 'success' ? (
        <button
          onClick={onClose}
          className="warp-btn"
          style={{ width: '100%', background: 'var(--warp-success)', color: '#000000', fontWeight: 'bold', padding: '10px 14px' }}
        >
          Close
        </button>
      ) : status === 'failed' || status === 'rejected' || status === 'timeout' ? (
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <button
            onClick={onClose}
            className="warp-btn secondary"
            style={{ flex: 1, padding: '10px 14px' }}
          >
            Dismiss
          </button>
          {modal.retryAction && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="warp-btn"
              style={{
                flex: 1,
                background: '#ffffff',
                color: '#000000',
                fontWeight: 'bold',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              {retrying && <Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />}
              {retrying ? 'Retrying...' : 'Retry Signature'}
            </button>
          )}
        </div>
      ) : (
        <span style={{ fontSize: 10, color: 'var(--warp-muted)', letterSpacing: '0.02em' }}>
          PLEASE DO NOT REFRESH OR CLOSE THIS TAB
        </span>
      )}
    </div>
  )
}

// ── 7. SYSTEM MODAL ──
export const SystemModal: React.FC<{ modal: ModalConfig; onClose: () => void }> = ({ modal, onClose }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px 0' }}>
      <div style={{
        background: 'rgba(143, 118, 255, 0.08)',
        border: '1px solid rgba(143, 118, 255, 0.2)',
        borderRadius: 8,
        padding: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
      }}>
        <ShieldAlert size={20} style={{ color: 'var(--warp-primary)' }} />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>{modal.title}</h3>
      <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: '0 0 20px 0', maxWidth: 360, lineHeight: 1.5 }}>
        {modal.description || 'System maintenance alert. Please review the details.'}
      </p>

      {modal.content}

      {!modal.preventBackdropClose && (
        <button
          onClick={onClose}
          className="warp-btn"
          style={{ width: '100%', background: 'var(--warp-primary)', color: '#000000', fontWeight: 'bold', padding: '10px 14px' }}
        >
          Acknowledge
        </button>
      )}
    </div>
  )
}
