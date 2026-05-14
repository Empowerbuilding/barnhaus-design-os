'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import type { Project, ProjectPhase, Activity, DesignPhase, HandOwnership } from '@/lib/supabase'
import { PHASES, PHASE_LABELS } from '@/lib/supabase'
import { getCardState, getCardClass, getTicker, getChecklist, type PhaseData, type OnUpdate } from '@/lib/card-utils'

interface Props {
  project: Project & { phase_data?: PhaseData | null }
  onUpdate: OnUpdate
  compact?: boolean
}

function EngRefTags({ p }: { p: Project }) {
  const engActive = p.engineering_required && p.engineering_status !== 'none'
  const refActive = p.referral_status === 'pending' || p.referral_status === 'complete'
  const shimmer = engActive && refActive ? ' tag-both-shimmer' : ''
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
  return (
    <span style={{ color, fontFamily: 'Oswald, sans-serif', fontWeight: value < 0 ? 700 : 600, fontSize: 18, lineHeight: 1 }}>
      {value}
    </span>
  )
}

export default function ProjectCard({ project: p, onUpdate, compact = false }: Props) {
  const [flipped, setFlipped] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [sparking, setSparking] = useState(false)
  const [phaseData, setPhaseData] = useState<PhaseData | null>(p.phase_data || null)
  const [newHand, setNewHand] = useState<HandOwnership>(p.current_hand)
  const [newPhase, setNewPhase] = useState<DesignPhase>(p.current_phase)
  const [tickerDate, setTickerDate] = useState<string>(p.ticker_start_date ? p.ticker_start_date.slice(0,10) : '')
  const [tickerDays, setTickerDays] = useState<number>(p.ticker_duration_days ?? 14)
  const [customMode, setCustomMode] = useState(false)
  const [customTasks, setCustomTasks] = useState<Record<string,boolean>>({})
  const [newTaskText, setNewTaskText] = useState('')
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDragging = useRef(false)
  const backRef = useRef<HTMLDivElement>(null)
  const [flipHeight, setFlipHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (flipped && backRef.current) {
      setFlipHeight(backRef.current.scrollHeight)
    } else {
      setFlipHeight(undefined)
    }
  }, [flipped, activity, p.notes])

  const state = getCardState(p, phaseData)
  const cardClass = getCardClass(state)
  const ticker = getTicker(p, state)

  // Unlock glow: only when draft_delivered is checked (the real final handoff)
  const unlocked = phaseData?.draft_delivered ? ' card-unlocked' : ''
  // Burning overlay: red border pulse on top of hand color
  const burningClass = p.is_burning ? ' card-burning' : ''

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/project/${p.id}`)
    const data = await res.json()
    setActivity(data.activity || [])
    const cur = (data.phases || []).find((ph: ProjectPhase) => ph.phase_name === p.current_phase)
    if (cur) {
      setPhaseData(cur)
      if (cur.tasks && Object.keys(cur.tasks).length > 0) {
        setCustomTasks(cur.tasks)
        setCustomMode(true)
      }
    }
  }, [p.id, p.current_phase])

  const patchTasks = async (tasks: Record<string,boolean>) => {
    await fetch(`/api/project/${p.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'patch_tasks', phase_name: p.current_phase, tasks })
    })
    setCustomTasks(tasks)
  }

  const addCustomTask = async () => {
    if (!newTaskText.trim()) return
    const updated = { ...customTasks, [newTaskText.trim()]: false }
    await patchTasks(updated)
    setNewTaskText('')
  }

  const toggleCustomTask = async (key: string) => {
    const updated = { ...customTasks, [key]: !customTasks[key] }
    await patchTasks(updated)
  }

  const deleteCustomTask = async (key: string) => {
    const updated = { ...customTasks }
    delete updated[key]
    await patchTasks(updated)
  }

  const clearCustomMode = async () => {
    await patchTasks({})
    setCustomMode(false)
    setCustomTasks({})
  }

  const handleClick = () => {
    // Don't register click if we just dragged
    if (isDragging.current) { isDragging.current = false; return }

    if (compact) {
      // Compact: single click just toggles expand, no flip
      if (!expanded && !phaseData) {
        setLoading(true)
        fetchDetail().finally(() => setLoading(false))
      }
      setExpanded(e => !e)
      return
    }

    // Full card: single vs double click
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      // Double click → flip (fetch detail if not loaded yet)
      if (activity.length === 0) {
        fetchDetail()
      }
      setFlipped(f => !f)
      return
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      // Single click → expand
      if (!expanded && !phaseData) {
        setLoading(true)
        fetchDetail().finally(() => setLoading(false))
      }
      setExpanded(e => !e)
    }, 220)
  }

  const doCheck = async (field: keyof PhaseData, value: boolean) => {
    setPhaseData(prev => prev
      ? { ...prev, [field]: value }
      : { review_scheduled: false, review_held: false, handoff_pending: false, polishing: false, draft_delivered: false, [field]: value }
    )
    setLoading(true)
    const res = await fetch(`/api/project/${p.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', phase_name: p.current_phase, field, value })
    })
    const data = await res.json()
    if (data.auto_flip) {
      setSparking(true)
      setTimeout(() => setSparking(false), 500)
      if (data.new_hand) setNewHand(data.new_hand as HandOwnership)
      await onUpdate()
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
    pre_kickoff: '⚪', freeze: '🧊', scheduled: '🟣', designer: '🟢', upworker: '🟡', client: '🔵', 'client-cooling': '🔵'
  }

  const checklist = (
    <div className="space-y-1.5">
      {getChecklist(p.current_phase).map(({ field, label }) => {
        const checked = !!(phaseData && phaseData[field])
        return (
          <label key={field} className="flex items-center gap-2 cursor-pointer" onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={checked} onChange={e => doCheck(field, e.target.checked)}
              className="accent-green-500 w-4 h-4" />
            <span style={{ fontSize: compact ? 10 : 11, color: checked ? '#22c55e' : '#9ca3af', textDecoration: checked ? 'line-through' : 'none' }}>
              {label}
            </span>
          </label>
        )
      })}
    </div>
  )

  // ── COMPACT (ribbon) ──────────────────────────────────────────
  if (compact) {
    return (
      <div className={`${cardClass}${unlocked} p-2 cursor-pointer`} onClick={handleClick}
        style={{ minHeight: 50, position: 'relative' }}>
        {sparking && <div className="spark" />}
        <div className="flex items-center justify-between mb-0.5">
          <span className="oswald font-semibold text-white truncate" style={{ fontSize: 11 }}>{p.client_name}</span>
          <TickerBadge {...ticker} />
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 9, color: '#6b7280', fontFamily: 'Oswald' }}>{PHASE_LABELS[p.current_phase].toUpperCase()}</span>
          <span style={{ fontSize: 11 }}>{stateLabel[state]}</span>
        </div>
        {loading && <p style={{ fontSize: 9, color: '#4b5563', marginTop: 2 }}>loading…</p>}
        {expanded && (
          <div onClick={e => e.stopPropagation()} className="mt-2 pt-2 border-t border-gray-800">
            {phaseData ? checklist : <p style={{ fontSize: 10, color: '#4b5563' }}>loading checklist…</p>}
          </div>
        )}
      </div>
    )
  }

  // ── FULL KANBAN CARD ──────────────────────────────────────────
  return (
    <div className="flip-container"
      onClick={handleClick}
      draggable
      onDragStart={e => {
        isDragging.current = true
        e.dataTransfer.setData('projectId', p.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={() => { setTimeout(() => { isDragging.current = false }, 50) }}
      style={{ cursor: 'grab' }}>
      <div className={`flip-inner${flipped ? ' flipped' : ''}`} style={flipHeight ? { height: flipHeight } : undefined}>

        {/* ── FRONT ─────────────────────────────────── */}
        <div className={`flip-front ${cardClass}${unlocked}${burningClass}`} style={{ minHeight: 72 }}>
          {sparking && <div className="spark" />}
          <div className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span style={{ fontSize: 12 }}>{stateLabel[state]}</span>
                  <h3 className="oswald font-semibold text-white truncate" style={{ fontSize: 13, letterSpacing: '0.04em' }}>{p.client_name}</h3>
                </div>
                <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'Oswald', letterSpacing: '0.06em' }}>{PHASE_LABELS[p.current_phase].toUpperCase()}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-center gap-1">
                  {p.is_burning && <span style={{ fontSize: 10 }}>🔥</span>}
                  <TickerBadge {...ticker} />
                </div>
                <EngRefTags p={p} />
              </div>
            </div>

            {loading && <p style={{ fontSize: 9, color: '#374151', marginTop: 4 }}>saving…</p>}

            {expanded && (
              <div onClick={e => e.stopPropagation()} className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid #1f2937' }}>

                {/* Checklist / Custom Tasks */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="oswald" style={{ fontSize: 9, color: '#374151', letterSpacing: '0.15em' }}>
                      {customMode ? 'CUSTOM TASKS' : 'CHECKLIST'}
                    </p>
                    <button
                      onClick={() => { if (customMode) clearCustomMode(); else setCustomMode(true) }}
                      style={{ fontSize: 8, padding: '1px 5px', background: customMode ? '#7f1d1d' : '#111', color: customMode ? '#fca5a5' : '#4b5563', border: `1px solid ${customMode ? '#991b1b' : '#1f2937'}`, borderRadius: 3, cursor: 'pointer' }}>
                      {customMode ? '✕ clear custom' : '+ custom'}
                    </button>
                  </div>
                  {customMode ? (
                    <div className="space-y-1.5">
                      {Object.entries(customTasks).map(([key, done]) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <input type="checkbox" checked={done} onChange={() => toggleCustomTask(key)} className="accent-green-500 w-4 h-4" />
                          <span style={{ fontSize: 11, flex: 1, color: done ? '#22c55e' : '#9ca3af', textDecoration: done ? 'line-through' : 'none' }}>{key}</span>
                          <button onClick={() => deleteCustomTask(key)} style={{ fontSize: 9, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                        </div>
                      ))}
                      <div className="flex gap-1 mt-1">
                        <input
                          value={newTaskText}
                          onChange={e => setNewTaskText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addCustomTask() }}
                          placeholder="Add task…"
                          style={{ fontSize: 10, flex: 1, background: '#0a0a0a', color: '#d1d5db', border: '1px solid #374151', borderRadius: 3, padding: '2px 6px' }}
                        />
                        <button onClick={addCustomTask} style={{ fontSize: 10, padding: '2px 8px', background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', borderRadius: 3, cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  ) : (
                    phaseData ? checklist : <p style={{ fontSize: 10, color: '#4b5563' }}>loading…</p>
                  )}
                </div>

                {/* Flip hand */}
                <div className="flex gap-1.5 flex-wrap">
                  <select value={newHand} onChange={e => setNewHand(e.target.value as HandOwnership)}
                    style={{ fontSize: 11, background: '#111', color: '#d1d5db', border: '1px solid #374151', borderRadius: 4, padding: '3px 6px' }}>
                    <option value="designer">🟢 Designer</option>
                    <option value="upworker">🟡 Upworker</option>
                    <option value="client">🔵 Client</option>
                  </select>
                  <button onClick={() => doUpdate({ current_hand: newHand })}
                    style={{ fontSize: 11, padding: '3px 10px', background: '#1f2937', color: '#d1d5db', borderRadius: 4, border: '1px solid #374151', cursor: 'pointer' }}>
                    Flip Hand
                  </button>
                </div>

                {/* Set phase */}
                <div className="flex gap-1.5 flex-wrap">
                  <select value={newPhase} onChange={e => setNewPhase(e.target.value as DesignPhase)}
                    style={{ fontSize: 11, background: '#111', color: '#d1d5db', border: '1px solid #374151', borderRadius: 4, padding: '3px 6px' }}>
                    {PHASES.map(ph => <option key={ph} value={ph}>{PHASE_LABELS[ph]}</option>)}
                  </select>
                  <button onClick={() => doUpdate({ current_phase: newPhase })}
                    style={{ fontSize: 11, padding: '3px 10px', background: '#1f2937', color: '#d1d5db', borderRadius: 4, border: '1px solid #374151', cursor: 'pointer' }}>
                    Set Phase
                  </button>
                </div>

                {/* Ticker edit */}
                <div>
                  <p className="oswald" style={{ fontSize: 9, color: '#374151', letterSpacing: '0.15em', marginBottom: 4 }}>SET TICKER</p>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    <input
                      type="date"
                      value={tickerDate}
                      onChange={e => setTickerDate(e.target.value)}
                      style={{ fontSize: 11, background: '#111', color: '#d1d5db', border: '1px solid #374151', borderRadius: 4, padding: '3px 6px' }}
                    />
                    <select value={tickerDays} onChange={e => setTickerDays(Number(e.target.value))}
                      style={{ fontSize: 11, background: '#111', color: '#d1d5db', border: '1px solid #374151', borderRadius: 4, padding: '3px 6px' }}>
                      {[7,10,14,21,28].map(d => <option key={d} value={d}>{d}d</option>)}
                    </select>
                    <button onClick={() => doUpdate({ ticker_start_date: tickerDate, ticker_duration_days: tickerDays })}
                      style={{ fontSize: 11, padding: '3px 10px', background: '#1f2937', color: '#d1d5db', borderRadius: 4, border: '1px solid #374151', cursor: 'pointer' }}>
                      Save
                    </button>
                  </div>
                </div>

                {p.notes && (
                  <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5, fontStyle: 'italic' }}>{p.notes}</p>
                )}

                <p style={{ fontSize: 9, color: '#1f2937', textAlign: 'right' }}>double-click → flip card</p>
              </div>
            )}
          </div>
        </div>

        {/* ── BACK ──────────────────────────────────── */}
        <div ref={backRef} className="flip-back p-3" style={{ minHeight: 72 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="oswald font-semibold text-white" style={{ fontSize: 13 }}>{p.client_name}</h3>
            <p style={{ fontSize: 9, color: '#374151' }}>double-click → flip back</p>
          </div>
          {p.client_email && <p style={{ fontSize: 11, color: '#60a5fa', marginBottom: 4 }}>✉ {p.client_email}</p>}
          {p.client_phone && <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>📞 {p.client_phone}</p>}
          {p.notes && (
            <div style={{ marginBottom: 8 }}>
              <p className="oswald" style={{ fontSize: 9, color: '#374151', letterSpacing: '0.15em', marginBottom: 4 }}>NOTES</p>
              <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{p.notes}</p>
            </div>
          )}
          {activity.length > 0 && (
            <div>
              <p className="oswald" style={{ fontSize: 9, color: '#374151', letterSpacing: '0.15em', marginBottom: 4 }}>ACTIVITY</p>
              {activity.slice(0, 5).map(a => (
                <div key={a.id} style={{ fontSize: 10, color: '#6b7280', marginBottom: 3 }}>
                  <span style={{ color: '#374151' }}>
                    {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>{' — '}{a.description}
                </div>
              ))}
            </div>
          )}
          {activity.length === 0 && !p.client_email && !p.notes && (
            <p style={{ fontSize: 11, color: '#1f2937' }}>No additional data</p>
          )}
        </div>

      </div>
    </div>
  )
}
