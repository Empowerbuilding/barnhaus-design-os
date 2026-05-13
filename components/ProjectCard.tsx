'use client'
import { useState, useRef, useCallback } from 'react'
import type { Project, ProjectPhase, Activity, DesignPhase, HandOwnership } from '@/lib/supabase'
import { PHASES, PHASE_LABELS } from '@/lib/supabase'
import { getCardState, getCardClass, getTicker, TASK_LABELS, type PhaseData } from '@/lib/card-utils'

interface Props {
  project: Project & { phase_data?: PhaseData | null }
  onUpdate: () => void
  compact?: boolean
}

function EngRefTags({ p, bothActive }: { p: Project; bothActive: boolean }) {
  const engActive = p.engineering_required && p.engineering_status !== 'none'
  const refActive = p.referral_status === 'pending' || p.referral_status === 'complete'
  const shimmer = engActive && refActive && bothActive ? ' tag-both-shimmer' : ''
  return (
    <div className="flex gap-1">
      {p.engineering_required && (
        <span className={`tag-ghost ${engActive ? 'tag-eng-active' : 'tag-eng-ghost'}${shimmer}`}>ENG</span>
      )}
      {p.referral_status !== 'none' && (
        <span className={`tag-ghost ${refActive ? 'tag-ref-active' : 'tag-ref-ghost'}${shimmer}`}>REF</span>
      )}
    </div>
  )
}

function TickerBadge({ value, color }: { value: number | null; color: string }) {
  if (value === null) return null
  const bold = value < 0
  return (
    <span style={{ color, fontFamily: 'Oswald, sans-serif', fontWeight: bold ? 700 : 600, fontSize: 18, lineHeight: 1 }}>
      {value}
    </span>
  )
}

export default function ProjectCard({ project: p, onUpdate, compact = false }: Props) {
  const [flipped, setFlipped] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [sparking, setSparking] = useState(false)
  const [phaseData, setPhaseData] = useState<PhaseData | null>(p.phase_data || null)
  const [newHand, setNewHand] = useState<HandOwnership>(p.current_hand)
  const [newPhase, setNewPhase] = useState<DesignPhase>(p.current_phase)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const state = getCardState(p, phaseData)
  const cardClass = getCardClass(state)
  const ticker = getTicker(p, state)

  // Check if all tasks done → unlocked
  const allDone = phaseData?.review_scheduled && phaseData?.review_held &&
    phaseData?.handoff_pending && phaseData?.draft_delivered
  const unlocked = allDone ? ' card-unlocked' : ''

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/project/${p.id}`)
    const data = await res.json()
    setPhases(data.phases || [])
    setActivity(data.activity || [])
    const cur = (data.phases || []).find((ph: ProjectPhase) => ph.phase_name === p.current_phase)
    if (cur) setPhaseData(cur)
  }, [p.id, p.current_phase])

  const handleClick = () => {
    // Distinguish single vs double click
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      // Double click → flip
      setFlipped(f => !f)
      return
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      // Single click → expand
      if (!expanded && phases.length === 0) {
        setLoading(true)
        fetchDetail().finally(() => setLoading(false))
      }
      setExpanded(e => !e)
    }, 220)
  }

  const doCheck = async (field: keyof PhaseData, value: boolean) => {
    // Optimistic update
    setPhaseData(prev => prev ? { ...prev, [field]: value } : { review_scheduled: false, review_held: false, handoff_pending: false, draft_delivered: false, [field]: value })

    setLoading(true)
    const res = await fetch(`/api/project/${p.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', phase_name: p.current_phase, field, value })
    })
    const data = await res.json()

    // If auto-flip happened, trigger spark + board refresh
    if (data.auto_flip) {
      setSparking(true)
      setTimeout(() => setSparking(false), 500)
      onUpdate()
    }
    await fetchDetail()
    setLoading(false)
  }

  const doUpdate = async (update: object) => {
    setLoading(true)
    await fetch(`/api/project/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    })
    setSparking(true)
    setTimeout(() => setSparking(false), 500)
    await onUpdate()
    setLoading(false)
  }

  const stateLabel: Record<string, string> = {
    burn: '🔥', freeze: '🧊', scheduled: '🟣', designer: '🟢', upworker: '🟡', client: '🔵'
  }

  if (compact) {
    // Ribbon mini-card
    return (
      <div className={`${cardClass}${unlocked} p-2 cursor-pointer text-xs`} onClick={handleClick} style={{ minHeight: 54 }}>
        {sparking && <div className="spark" />}
        <div className="flex items-center justify-between mb-1">
          <span className="oswald font-semibold text-white" style={{ fontSize: 11 }}>{p.client_name}</span>
          <TickerBadge {...ticker} />
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 10, color: '#6b7280' }}>{PHASE_LABELS[p.current_phase]}</span>
          <span>{stateLabel[state]}</span>
        </div>
        {phaseData && expanded && (
          <div onClick={e => e.stopPropagation()} className="mt-2 space-y-1 border-t border-gray-800 pt-2">
            {(Object.keys(TASK_LABELS) as (keyof PhaseData)[]).map(field => (
              <label key={field} className="flex items-center gap-1.5 cursor-pointer" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={!!phaseData[field]} onChange={e => doCheck(field, e.target.checked)}
                  className="accent-green-500 w-3 h-3" />
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{TASK_LABELS[field]}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Full kanban card
  return (
    <div className={`flip-container`} onClick={handleClick}
      draggable
      onDragStart={e => e.dataTransfer.setData("projectId", p.id)}
      style={{ cursor: "grab" }}>
      <div className={`flip-inner${flipped ? ' flipped' : ''}`}>

        {/* ── FRONT ─────────────────────────────────────────── */}
        <div className={`flip-front ${cardClass}${unlocked}`} style={{ minHeight: expanded ? 'auto' : 72 }}>
          {sparking && <div className="spark" />}
          <div className="p-3">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span style={{ fontSize: 13 }}>{stateLabel[state]}</span>
                  <h3 className="oswald font-semibold text-white truncate" style={{ fontSize: 13, letterSpacing: '0.04em' }}>{p.client_name}</h3>
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'Oswald' }}>{PHASE_LABELS[p.current_phase].toUpperCase()}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <TickerBadge {...ticker} />
                <EngRefTags p={p} bothActive={true} />
              </div>
            </div>

            {loading && <p style={{ fontSize: 10, color: '#4b5563', marginTop: 4 }}>saving…</p>}

            {/* Expanded content */}
            {expanded && (
              <div onClick={e => e.stopPropagation()} className="mt-3 border-t border-gray-800 pt-3 space-y-3">

                {/* Checklist */}
                <div>
                  <p className="oswald" style={{ fontSize: 10, color: '#4b5563', letterSpacing: '0.1em', marginBottom: 6 }}>CHECKLIST</p>
                  <div className="space-y-1.5">
                    {(Object.keys(TASK_LABELS) as (keyof PhaseData)[]).map(field => {
                      const checked = !!(phaseData && phaseData[field])
                      return (
                        <label key={field} className="flex items-center gap-2 cursor-pointer" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={checked} onChange={e => doCheck(field, e.target.checked)}
                            className="accent-green-500 w-4 h-4" />
                          <span style={{ fontSize: 11, color: checked ? '#22c55e' : '#9ca3af', textDecoration: checked ? 'line-through' : 'none' }}>
                            {TASK_LABELS[field]}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap gap-1.5">
                  <select value={newHand} onChange={e => setNewHand(e.target.value as HandOwnership)}
                    className="text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-200" style={{ fontSize: 11 }}>
                    <option value="designer">🟢 Designer</option>
                    <option value="upworker">🟡 Upworker</option>
                    <option value="client">🔵 Client</option>
                  </select>
                  <button onClick={() => doUpdate({ current_hand: newHand })}
                    style={{ fontSize: 11, padding: '3px 10px', background: '#1f2937', color: '#d1d5db', borderRadius: 4, border: '1px solid #374151', cursor: 'pointer' }}>
                    Flip Hand
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <select value={newPhase} onChange={e => setNewPhase(e.target.value as DesignPhase)}
                    className="text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-200" style={{ fontSize: 11 }}>
                    {PHASES.map(ph => <option key={ph} value={ph}>{PHASE_LABELS[ph]}</option>)}
                  </select>
                  <button onClick={() => doUpdate({ current_phase: newPhase })}
                    style={{ fontSize: 11, padding: '3px 10px', background: '#1f2937', color: '#d1d5db', borderRadius: 4, border: '1px solid #374151', cursor: 'pointer' }}>
                    Set Phase
                  </button>
                </div>

                {p.notes && (
                  <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5, fontStyle: 'italic' }}>{p.notes}</p>
                )}

                <p style={{ fontSize: 9, color: '#374151', textAlign: 'right' }}>double-click to flip card</p>
              </div>
            )}
          </div>
        </div>

        {/* ── BACK ──────────────────────────────────────────── */}
        <div className="flip-back p-3" style={{ minHeight: 72 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="oswald font-semibold text-white" style={{ fontSize: 13 }}>{p.client_name}</h3>
            <p style={{ fontSize: 9, color: '#4b5563' }}>double-click to flip back</p>
          </div>

          {p.client_email && (
            <p style={{ fontSize: 11, color: '#60a5fa', marginBottom: 4 }}>✉ {p.client_email}</p>
          )}
          {p.client_phone && (
            <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>📞 {p.client_phone}</p>
          )}

          {p.notes && (
            <div style={{ marginBottom: 8 }}>
              <p className="oswald" style={{ fontSize: 9, color: '#4b5563', letterSpacing: '0.1em', marginBottom: 4 }}>NOTES</p>
              <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{p.notes}</p>
            </div>
          )}

          {activity.length > 0 && (
            <div>
              <p className="oswald" style={{ fontSize: 9, color: '#4b5563', letterSpacing: '0.1em', marginBottom: 4 }}>RECENT ACTIVITY</p>
              {activity.slice(0, 4).map(a => (
                <div key={a.id} style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>
                  <span style={{ color: '#374151' }}>{new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  {' — '}{a.description}
                </div>
              ))}
            </div>
          )}

          {activity.length === 0 && !p.client_email && !p.notes && (
            <p style={{ fontSize: 11, color: '#374151' }}>No additional data</p>
          )}
        </div>

      </div>
    </div>
  )
}
