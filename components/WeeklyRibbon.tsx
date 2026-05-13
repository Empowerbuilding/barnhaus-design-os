'use client'
import { useMemo, useState, useCallback } from 'react'
import type { Project } from '@/lib/supabase'
import { getCardState, getCardClass, getTicker, getRibbonTask, PHASE_WEIGHT, TASK_LABELS, type PhaseData, type OnUpdate } from '@/lib/card-utils'
import { PHASE_LABELS } from '@/lib/supabase'

type ProjectWithPhase = Project & { phase_data?: PhaseData | null }

interface Props {
  projects: ProjectWithPhase[]
  onUpdate: OnUpdate
}

const CONFIRMED_KEY = 'ribbon_confirmed'
function loadConfirmed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CONFIRMED_KEY) || '{}') } catch { return {} }
}
function saveConfirmed(m: Record<string, number>) {
  localStorage.setItem(CONFIRMED_KEY, JSON.stringify(m))
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
  if (state === 'burn' || state === 'scheduled') return todayIndex
  if ((state === 'designer' || state === 'upworker') && p.countdown_ticker !== null) {
    if (p.countdown_ticker <= 0) return todayIndex
    return Math.min(todayIndex + p.countdown_ticker, 6)
  }
  return null
}

function RibbonCard({ p, isGhost, onVanish, onUpdate }: {
  p: ProjectWithPhase
  isGhost: boolean
  onVanish: (id: string) => void
  onUpdate: OnUpdate
}) {
  const [vanishing, setVanishing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localPhase, setLocalPhase] = useState<PhaseData | null>(p.phase_data || null)

  const state = getCardState(p, localPhase)
  const cardClass = getCardClass(state)
  const ticker = getTicker(p, state)
  const ribbonTask = getRibbonTask(localPhase)

  const handleCheck = async (field: keyof PhaseData) => {
    setLocalPhase(prev => prev
      ? { ...prev, [field]: true }
      : { review_scheduled: false, review_held: false, handoff_pending: false, draft_delivered: false, [field]: true }
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

  return (
    <div
      className={`${cardClass}${isGhost ? ' card-ghost' : ''}${vanishing ? ' card-vanishing' : ''} p-2`}
      style={{ minHeight: 46, position: 'relative', cursor: isGhost ? 'grab' : 'default' }}
      draggable={isGhost}
      onDragStart={e => {
        e.dataTransfer.setData('ribbonProjectId', p.id)
        e.dataTransfer.effectAllowed = 'move'
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
      </div>
      <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'Oswald', letterSpacing: '0.05em', marginBottom: ribbonTask && !isGhost ? 4 : 0 }}>
        {PHASE_LABELS[p.current_phase]?.toUpperCase()}
      </div>
      {ribbonTask && !isGhost && (
        <label className="flex items-center gap-1.5 cursor-pointer" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={false} onChange={() => handleCheck(ribbonTask)} className="accent-green-500 w-3 h-3" />
          <span style={{ fontSize: 9, color: '#6b7280' }}>{TASK_LABELS[ribbonTask]}</span>
        </label>
      )}
      {isGhost && <div style={{ fontSize: 8, color: '#374151', fontStyle: 'italic', marginTop: 2 }}>drag to confirm</div>}
    </div>
  )
}

export default function WeeklyRibbon({ projects, onUpdate }: Props) {
  const { days, todayIndex } = useMemo(() => getWeekDays(), [])
  const [confirmed, setConfirmed] = useState<Record<string, number>>(loadConfirmed)
  const [vanished, setVanished] = useState<Set<string>>(new Set())
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  const activeProjects = projects.filter(p => p.current_phase !== 'archived' && !vanished.has(p.id))

  const { dayMap, ghostMap } = useMemo(() => {
    const solid: Record<number, ProjectWithPhase[]> = {}
    const ghost: Record<number, ProjectWithPhase[]> = {}
    days.forEach(d => { solid[d.index] = []; ghost[d.index] = [] })
    activeProjects.forEach(p => {
      const autoDay = autoSlotIndex(p, todayIndex)
      if (autoDay === null) return
      const confirmedDay = confirmed[p.id]
      if (confirmedDay !== undefined) {
        solid[confirmedDay] = [...(solid[confirmedDay] || []), p]
      } else {
        ghost[autoDay] = [...(ghost[autoDay] || []), p]
      }
    })
    return { dayMap: solid, ghostMap: ghost }
  }, [activeProjects, confirmed, days, todayIndex])

  const frozen = activeProjects.filter(p => getCardState(p, p.phase_data) === 'freeze')

  const loadForDay = (idx: number) => {
    const ps = [...(dayMap[idx] || []), ...(ghostMap[idx] || [])]
    if (!ps.length) return 0
    return Math.min(ps.reduce((s, p) => s + (PHASE_WEIGHT[p.current_phase] || 0), 0) / 2.5, 1)
  }
  const loadColor = (l: number) => l > 0.8 ? '#ef4444' : l > 0.5 ? '#f59e0b' : '#22c55e'

  const handleConfirm = useCallback((id: string, dayIdx: number) => {
    setConfirmed(prev => { const n = { ...prev, [id]: dayIdx }; saveConfirmed(n); return n })
  }, [])

  const handleVanish = useCallback((id: string) => {
    setVanished(prev => { const s = new Set(prev); s.add(id); return s })
    setConfirmed(prev => { const n = { ...prev }; delete n[id]; saveConfirmed(n); return n })
  }, [])

  const handleDrop = (e: React.DragEvent, dayIdx: number) => {
    e.preventDefault()
    setDropTarget(null)
    const id = e.dataTransfer.getData('ribbonProjectId') || e.dataTransfer.getData('projectId')
    if (id) handleConfirm(id, dayIdx)
  }

  const totalRibbon = Object.values(dayMap).flat().length + Object.values(ghostMap).flat().length

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
          const ghosts = ghostMap[day.index] || []
          const load = loadForDay(day.index)
          const isPast = day.index < todayIndex
          return (
            <div key={day.key}
              className={`ribbon-day${day.isToday ? ' today' : ''}${dropTarget === day.index ? ' ribbon-day-drop-active' : ''}`}
              style={{ padding: '4px 0', opacity: isPast ? 0.4 : 1, minWidth: 120 }}
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
              <div style={{ padding: '3px 6px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', maxHeight: 192 }}>
                {solids.length === 0 && ghosts.length === 0
                  ? <div style={{ fontSize: 9, color: '#1a1a1a', textAlign: 'center', paddingTop: 6 }}>—</div>
                  : <>
                    {solids.map(p => <RibbonCard key={p.id} p={p} isGhost={false} onVanish={handleVanish} onUpdate={onUpdate} />)}
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
      </div>
    </div>
  )
}
