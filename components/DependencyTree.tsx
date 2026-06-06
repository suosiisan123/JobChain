import React from 'react'
import { formatUnits } from 'viem'
import { CheckCircle, Play, AlertCircle, HelpCircle } from 'lucide-react'
import { EURC_ADDRESS_ARC } from '@/lib/contracts'

interface JobData {
  id: number
  poster: string
  description: string
  requiredCapabilities: string
  reward: bigint
  deadline: number
  assignedAgent: number
  status: number
  resultHash: string
  rating: number
  createdAt: number
  paymentToken: string
  failedAt: number
  parentJobId?: number
  hasParent?: boolean
}

const STATUS_LABELS = ['Open', 'InProgress', 'Submitted', 'Completed', 'Failed', 'Cancelled', 'Disputed'] as const
const STATUS_COLORS: Record<string, string> = {
  Open: 'var(--warp-primary)',
  InProgress: 'var(--warp-warning)',
  Submitted: 'var(--warp-cyan)',
  Completed: 'var(--warp-success)',
  Failed: 'var(--warp-error)',
  Cancelled: 'var(--warp-muted)',
  Disputed: 'var(--warp-magenta)'
}

interface TreeNode {
  job: JobData
  children: TreeNode[]
}

interface DependencyTreeProps {
  jobs: JobData[]
  rootJobId: number
}

export function DependencyTree({ jobs, rootJobId }: DependencyTreeProps) {
  // Construct tree
  const buildTree = (rootId: number): TreeNode | null => {
    const rootJob = jobs.find(j => j.id === rootId)
    if (!rootJob) return null

    const children = jobs
      .filter(j => j.hasParent && j.parentJobId === rootId)
      .map(child => buildTree(child.id))
      .filter(Boolean) as TreeNode[]

    return {
      job: rootJob,
      children
    }
  }

  const tree = buildTree(rootJobId)
  if (!tree) return null

  // If the root has no sub-jobs, don't render anything
  if (tree.children.length === 0) {
    return null
  }

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const statusLabel = STATUS_LABELS[node.job.status] || 'Unknown'
    const statusColor = STATUS_COLORS[statusLabel] || 'var(--warp-muted)'
    
    // Status Icon
    let StatusIcon = HelpCircle
    if (statusLabel === 'Completed') StatusIcon = CheckCircle
    else if (statusLabel === 'InProgress') StatusIcon = Play
    else if (statusLabel === 'Failed') StatusIcon = AlertCircle

    return (
      <div key={node.job.id} style={{ marginLeft: depth > 0 ? 24 : 0, marginTop: 8 }}>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: 'rgba(26, 27, 38, 0.8)', 
            borderLeft: `3px solid ${statusColor}`,
            padding: '8px 12px', 
            borderRadius: '4px',
            gap: 12,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            fontFamily: 'monospace',
            border: '1px solid var(--warp-border)',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--warp-primary)', fontWeight: 'bold' }}>#{node.job.id}</span>
            <span style={{ color: 'var(--warp-text)', fontSize: 13 }}>{node.job.description}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {/* Reward */}
            <span style={{ color: 'var(--warp-success)', fontSize: 12, fontWeight: 600 }}>
              {formatUnits(node.job.reward, 6)}{' '}
              {node.job.paymentToken?.toLowerCase() === EURC_ADDRESS_ARC.toLowerCase() ? 'EURC' : 'USDC'}
            </span>

            {/* Agent */}
            {node.job.assignedAgent > 0 ? (
              <span style={{ background: 'rgba(187, 154, 247, 0.1)', color: 'var(--warp-magenta)', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                Agent #{node.job.assignedAgent}
              </span>
            ) : (
              <span style={{ color: 'var(--warp-muted)', fontSize: 10 }}>Unassigned</span>
            )}

            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: statusColor, fontSize: 11, fontWeight: 'bold' }}>
              <StatusIcon size={12} />
              <span>{statusLabel}</span>
            </div>
          </div>
        </div>

        {node.children.length > 0 && (
          <div 
            style={{ 
              position: 'relative',
              paddingLeft: 4
            }}
          >
            {/* Vertical connector line */}
            <div 
              style={{
                position: 'absolute',
                left: 8,
                top: 0,
                bottom: 16,
                width: 1,
                background: 'var(--warp-border)'
              }}
            />
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 16px', background: '#13141f', border: '1px dashed var(--warp-border)', borderRadius: 8, marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warp-muted)', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
        Task Delegation Tree (Parent #{rootJobId})
      </div>
      {renderNode(tree)}
    </div>
  )
}
