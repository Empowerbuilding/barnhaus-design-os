'use client'
import { useMemo, useState, useCallback, useRef } from 'react'
import type { Project } from '@/lib/supabase'
import { getCardState, getCardClass, getTicker, getRibbonTask, getRibbonTaskLabel, PHASE_WEIGHT, type PhaseData, type OnUpdate } from '@/lib/card-utils'
import { PHASE_LABELS } from '@/lib/supabase'

type ProjectWithPhase = Project & { phase_data?: PhaseData | null }

interface Props {
  projects: ProjectWithPhase[]
  onUpdate: OnUpdate
}

function getWeekKey(): string {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  return `ribbon-confirmed-${monday.toISOString().slice(0, 10)}`
}
function loadConfirmedForWeek(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(getWeekKey()) || '{}') } catch { return {} }
}
function saveConfirmedForWeek(m: Record<string, number>) {
  localStorage.setItem(getWeekKey(), JSON.stringify(m))
}


function getWeekDays() {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const todayIndex = (dayOfWeek + 6) % 7
  return {
    days: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return { date: d, label: d.toLocaleDateString('en-US', { weekday: 'short' }), key: d.toDateString(), isToday: d.toDateString() === now.toDateString(), index: i }
    }),
    todayIndex
  }
}

function autoSlotIndex(p: ProjectWithPhase, todayIndex: number): number | null {
  const state = getCardState(p, p.phase_data)
  if (p.is_burning || state === 'scheduled') return todayIndex
  if ((state === 'designer' || state === 'upworker') && p.countdown_ticker !== null) {
    if (p.countdown_ticker <= 0) return todayIndex
    return Math.min(todayIndex + p.countdown_ticker, 6)
  }
  return null
}

function RibbonCard({ p, isGhost, onVanish, onUnconfirm, onUpdate }: {
  p: ProjectWithPhase
  isGhost: boolean
  onVanish: (id: string) => void
  onUnconfirm?: (id: string) => void
  onUpdate: OnUpdate
}) {
  const [vanishing, setVanishing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localPhase, setLocalPhase] = useState<PhaseData | null>(p.phase_data || null)

  const state = getCardState(p, localPhase)
  const cardClass = getCardClass(state)
  const ticker = getTicker(p, state)
  const ribbonTask = getRibbonTask(localPhase, p.current_phase)

  const handleCheck = async (field: keyof PhaseData) => {
    setLocalPhase(prev => prev
      ? { ...prev, [field]: true }
      : { review_scheduled: false, review_held: false, handoff_pending: false, polishing: false, draft_delivered: false, [field]: true }
    )
    setLoading(true)
    await fetch(`/api/project/${p.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', phase_name: p.current_phase, field, value: true })
    })
    setLoading(false)
    setTimeout(() => {
      setVanishing(true)
      setTimeout(() => { onVanish(p.id); onUpdate() }, 420)
    }, 280)
  }

  const stateEmoji: Record<string, string> = {
    burn: '🔥', freeze: '🧊', scheduled: '🟣', designer: '🟢', upworker: '🟡', client: '🔵', 'client-cooling': '🔵'
  }

  const cardRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={cardRef}
      className={`${cardClass}${isGhost ? ' card-ghost' : ''}${vanishing ? ' card-vanishing' : ''} p-2`}
      style={{ height: 68, overflow: 'hidden', position: 'relative', cursor: isGhost ? 'grab' : 'default', flexShrink: 0 }}
      draggable={isGhost || !isGhost}
      onDragStart={e => {
        e.dataTransfer.setData('ribbonProjectId', p.id)
        e.dataTransfer.effectAllowed = 'move'
        // Use the card element itself as drag image to avoid 3D flip ghost artifacts
        if (cardRef.current) {
          e.dataTransfer.setDragImage(cardRef.current, 40, 20)
        }
      }}
    >
      {loading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', borderRadius: 4, zIndex: 10 }} />}
      <div className="flex items-center justify-between mb-0.5">
        <span style={{ fontSize: 9 }}>{stateEmoji[state] || '⚪'}</span>
        <span className="oswald font-semibold text-white truncate mx-1" style={{ fontSize: 11, flex: 1 }}>{p.client_name}</span>
        {ticker.value !== null && (
          <span style={{ color: ticker.color, fontFamily: 'Oswald', fontWeight: ticker.value < 0 ? 700 : 600, fontSize: 15 }}>
            {ticker.value}
          </span>
        )}
        {!isGhost && onUnconfirm && (
          <button onClick={e => { e.stopPropagation(); onUnconfirm(p.id) }}
            style={{ fontSize: 9, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
            title="Move back to shadow">×</button>
        )}
      </div>
      <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'Oswald', letterSpacing: '0.05em', marginBottom: 2 }}>
        {PHASE_LABELS[p.current_phase]?.toUpperCase()}
      </div>
      <div style={{ height: 16, display: 'flex', alignItems: 'center' }}>
        {ribbonTask && !isGhost ? (
          <label className="flex items-center gap-1.5 cursor-pointer" onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={false} onChange={() => handleCheck(ribbonTask)} className="accent-green-500 w-3 h-3" />
            <span style={{ fontSize: 9, color: '#6b7280' }}>{getRibbonTaskLabel(ribbonTask, p.current_phase)}</span>
          </label>
        ) : isGhost ? (
          <span style={{ fontSize: 8, color: '#374151', fontStyle: 'italic' }}>drag to confirm</span>
        ) : null}
      </div>
    </div>
  )
}

export default function WeeklyRibbon({ projects, onUpdate }: Props) {
  const { days, todayIndex } = useMemo(() => getWeekDays(), [])
  const [confirmed, setConfirmed] = useState<Record<string, number>>(loadConfirmedForWeek)
  const [vanished, setVanished] = useState<Set<string>>(new Set())
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  const activeProjects = projects.filter(p => p.current_phase !== 'archived' && !vanished.has(p.id))

  const { dayMap, deckCards } = useMemo(() => {
    const solid: Record<number, ProjectWithPhase[]> = {}
    const deck: ProjectWithPhase[] = []
    days.forEach(d => { solid[d.index] = [] })
    activeProjects.forEach(p => {
      const autoDay = autoSlotIndex(p, todayIndex)
      if (autoDay === null) return
      const confirmedDay = confirmed[p.id]
      if (confirmedDay !== undefined) {
        solid[confirmedDay] = [...(solid[confirmedDay] || []), p]
      } else {
        deck.push(p)
      }
    })
    return { dayMap: solid, deckCards: deck }
  }, [activeProjects, confirmed, days, todayIndex])

  const frozen = activeProjects.filter(p => getCardState(p, p.phase_data) === 'freeze')

  const loadForDay = (idx: number) => {
    const ps = [...(dayMap[idx] || [])]
    if (!ps.length) return 0
    return Math.min(ps.reduce((s, p) => s + (PHASE_WEIGHT[p.current_phase] || 0), 0) / 2.5, 1)
  }
  const loadColor = (l: number) => l > 0.8 ? '#ef4444' : l > 0.5 ? '#f59e0b' : '#22c55e'

  const handleConfirm = useCallback((id: string, dayIdx: number) => {
    setConfirmed(prev => { const n = { ...prev, [id]: dayIdx }; saveConfirmedForWeek(n); return n })
    // Persist ribbon_date to Supabase so Juanito can read it in briefings
    const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const ribbonDate = new Date(monday); ribbonDate.setDate(monday.getDate() + dayIdx)
    const dateStr = ribbonDate.toISOString().slice(0, 10)
    fetch(`/api/project/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ribbon_date: dateStr })
    }).catch(() => {})
  }, [])

  const handleUnconfirm = useCallback((id: string) => {
    setConfirmed(prev => { const n = { ...prev }; delete n[id]; saveConfirmedForWeek(n); return n })
    // Clear ribbon_date in Supabase
    fetch(`/api/project/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ribbon_date: null })
    }).catch(() => {})
  }, [])

  const handleVanish = useCallback((id: string) => {
    setVanished(prev => { const s = new Set(prev); s.add(id); return s })
    setConfirmed(prev => { const n = { ...prev }; delete n[id]; saveConfirmedForWeek(n); return n })
  }, [])

  const handleDrop = (e: React.DragEvent, dayIdx: number) => {
    e.preventDefault()
    setDropTarget(null)
    const id = e.dataTransfer.getData('ribbonProjectId') || e.dataTransfer.getData('projectId')
    if (id) handleConfirm(id, dayIdx)
  }

  const totalRibbon = Object.values(dayMap).flat().length + deckCards.length

  return (
    <div style={{ borderBottom: '2px solid #1f2937', background: '#080808', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px', borderBottom: '1px solid #111' }}>
        <span className="oswald" style={{ fontSize: 10, color: '#374151', letterSpacing: '0.18em' }}>WEEKLY RIBBON</span>
        <span className="badge badge-amber" style={{ fontSize: 8 }}>ACTIVE WORKSPACE</span>
        <span style={{ fontSize: 9, color: '#374151' }}>{totalRibbon} cards · drag from deck below to confirm</span>
        {frozen.length > 0 && <span className="badge badge-blue" style={{ fontSize: 8 }}>{frozen.length} frozen</span>}
      </div>
      <div style={{ display: 'flex', overflowX: 'auto' }}>
        {days.map(day => {
          const solids = dayMap[day.index] || []
          const ghosts: ProjectWithPhase[] = []
          const load = loadForDay(day.index)
          const isPast = day.index < todayIndex
          return (
            <div key={day.key}
              className={`ribbon-day${day.isToday ? ' today' : ''}${dropTarget === day.index ? ' ribbon-day-drop-active' : ''}`}
              style={{ padding: '4px 0', opacity: isPast ? 0.4 : 1, minWidth: 120, display: 'flex', flexDirection: 'column', maxHeight: 270 }}
              onDragOver={e => { e.preventDefault(); setDropTarget(day.index) }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={e => handleDrop(e, day.index)}
            >
              <div style={{ padding: '0 8px 3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="oswald" style={{ fontSize: 10, letterSpacing: '0.06em', color: day.isToday ? '#f59e0b' : '#374151', fontWeight: day.isToday ? 700 : 400 }}>
                  {day.isToday ? '● TODAY' : day.label.toUpperCase()}
                </span>
                {(solids.length + ghosts.length) > 0 && <span style={{ fontSize: 9, color: '#374151' }}>{solids.length + ghosts.length}</span>}
              </div>
              <div className="load-bar-track">
                <div className="load-bar-fill" style={{ width: `${load * 100}%`, background: loadColor(load) }} />
              </div>
              <div style={{ padding: '3px 6px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {solids.length === 0 && ghosts.length === 0
                  ? <div style={{ fontSize: 9, color: '#1a1a1a', textAlign: 'center', paddingTop: 6 }}>—</div>
                  : <>
                    {solids.map(p => <RibbonCard key={p.id} p={p} isGhost={false} onVanish={handleVanish} onUnconfirm={handleUnconfirm} onUpdate={onUpdate} />)}
                    {ghosts.map(p => <RibbonCard key={p.id} p={p} isGhost={true} onVanish={handleVanish} onUpdate={onUpdate} />)}
                  </>
                }
              </div>
            </div>
          )
        })}
        {frozen.length > 0 && (
          <div style={{ flexShrink: 0, width: 130, borderLeft: '1px solid #1f2937', padding: '4px 0' }}>
            <div style={{ padding: '0 8px 3px' }}>
              <span className="oswald" style={{ fontSize: 10, color: '#2563eb', letterSpacing: '0.06em' }}>🧊 FROZEN</span>
            </div>
            <div className="load-bar-track" style={{ background: '#082032' }}>
              <div style={{ width: '100%', height: '100%', background: '#1d4ed8', borderRadius: 2 }} />
            </div>
            <div style={{ padding: '3px 6px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {frozen.map(p => <RibbonCard key={p.id} p={p} isGhost={false} onVanish={handleVanish} onUpdate={onUpdate} />)}
            </div>
          </div>
        )}
        {deckCards.length > 0 && (
          <div style={{ flexShrink: 0, width: 150, borderLeft: '1px solid #374151', padding: '4px 0', background: '#050505' }}>
            <div style={{ padding: '0 8px 3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="oswald" style={{ fontSize: 10, color: '#4b5563', letterSpacing: '0.12em' }}>DECK</span>
              <span style={{ fontSize: 9, color: '#374151' }}>{deckCards.length}</span>
            </div>
            <div className="load-bar-track"><div style={{ width: '0%' }} /></div>
            <div style={{ padding: '3px 6px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', maxHeight: 230 }}>
              {deckCards.map(p => <RibbonCard key={p.id} p={p} isGhost={true} onVanish={handleVanish} onUpdate={onUpdate} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
