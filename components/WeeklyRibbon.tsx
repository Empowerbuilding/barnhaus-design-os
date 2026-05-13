'use client'
import { useMemo } from 'react'
import type { Project } from '@/lib/supabase'
import { getCardState, PHASE_WEIGHT, type PhaseData, type OnUpdate } from '@/lib/card-utils'
import ProjectCard from './ProjectCard'

type ProjectWithPhase = Project & { phase_data?: PhaseData | null }

interface Props {
  projects: ProjectWithPhase[]
  onUpdate: OnUpdate
}

function getWeekDays() {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const todayIndex = (dayOfWeek + 6) % 7 // Mon=0 … Sun=6

  return { days: Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const isToday = d.toDateString() === now.toDateString()
    return { date: d, label: d.toLocaleDateString('en-US', { weekday: 'short' }), key: d.toDateString(), isToday, index: i }
  }), todayIndex }
}

function slotProject(p: ProjectWithPhase, todayIndex: number): number | null {
  const state = getCardState(p, p.phase_data)
  if (state === 'burn' || state === 'scheduled') return todayIndex
  if ((state === 'designer' || state === 'upworker') && p.countdown_ticker !== null) {
    if (p.countdown_ticker <= 0) return todayIndex
    // Slot into correct future day: today's index + days remaining, capped at 6
    const targetIndex = Math.min(todayIndex + p.countdown_ticker, 6)
    return targetIndex
  }
  return null
}

export default function WeeklyRibbon({ projects, onUpdate }: Props) {
  const { days, todayIndex } = useMemo(() => getWeekDays(), [])
  const activeProjects = projects.filter(p => p.current_phase !== 'archived')

  const dayMap = useMemo(() => {
    const map: Record<number, ProjectWithPhase[]> = {}
    days.forEach(d => { map[d.index] = [] })
    activeProjects.forEach(p => {
      const idx = slotProject(p, todayIndex)
      if (idx !== null && map[idx]) map[idx].push(p)
    })
    return map
  }, [activeProjects, days, todayIndex])

  const frozen = activeProjects.filter(p => getCardState(p, p.phase_data) === 'freeze')

  const loadForDay = (idx: number) => {
    const ps = dayMap[idx] || []
    if (!ps.length) return 0
    const total = ps.reduce((sum, p) => sum + (PHASE_WEIGHT[p.current_phase] || 0), 0)
    return Math.min(total / 2.5, 1)
  }

  const loadColor = (load: number) => load > 0.8 ? '#ef4444' : load > 0.5 ? '#f59e0b' : '#22c55e'

  const totalRibbonCards = activeProjects.filter(p => {
    const state = getCardState(p, p.phase_data)
    return state === 'burn' || state === 'scheduled' ||
      ((state === 'designer' || state === 'upworker') && p.countdown_ticker !== null && p.countdown_ticker <= 6)
  }).length

  return (
    <div style={{ borderBottom: '2px solid #1f2937', background: '#080808', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px', borderBottom: '1px solid #111' }}>
        <span className="oswald" style={{ fontSize: 10, color: '#374151', letterSpacing: '0.18em' }}>WEEKLY RIBBON</span>
        <span className="badge badge-amber" style={{ fontSize: 8 }}>ACTIVE WORKSPACE</span>
        <span style={{ fontSize: 9, color: '#374151' }}>{totalRibbonCards} cards this week</span>
        {frozen.length > 0 && <span className="badge badge-blue" style={{ fontSize: 8 }}>{frozen.length} frozen →</span>}
      </div>

      <div style={{ display: 'flex', overflowX: 'auto' }}>
        {days.map(day => {
          const ps = dayMap[day.index] || []
          const load = loadForDay(day.index)
          const isPast = day.index < todayIndex
          return (
            <div key={day.key} className={`ribbon-day${day.isToday ? ' today' : ''}`}
              style={{ padding: '4px 0', opacity: isPast ? 0.4 : 1, minWidth: 110 }}>
              <div style={{ padding: '0 8px 3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="oswald" style={{
                  fontSize: 10, letterSpacing: '0.06em',
                  color: day.isToday ? '#f59e0b' : '#374151',
                  fontWeight: day.isToday ? 700 : 400
                }}>
                  {day.isToday ? '● TODAY' : day.label.toUpperCase()}
                </span>
                {ps.length > 0 && <span style={{ fontSize: 9, color: '#374151' }}>{ps.length}</span>}
              </div>
              <div className="load-bar-track">
                <div className="load-bar-fill" style={{ width: `${load * 100}%`, background: loadColor(load) }} />
              </div>
              <div style={{ padding: '3px 6px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {ps.length === 0
                  ? <div style={{ fontSize: 9, color: '#1a1a1a', textAlign: 'center', paddingTop: 6 }}>—</div>
                  : ps.map(p => <ProjectCard key={p.id} project={p} onUpdate={onUpdate} compact />)
                }
              </div>
            </div>
          )
        })}

        {/* Frozen column */}
        {frozen.length > 0 && (
          <div style={{ flexShrink: 0, width: 130, borderLeft: '1px solid #1f2937', padding: '4px 0' }}>
            <div style={{ padding: '0 8px 3px' }}>
              <span className="oswald" style={{ fontSize: 10, color: '#2563eb', letterSpacing: '0.06em' }}>🧊 FROZEN</span>
            </div>
            <div className="load-bar-track" style={{ background: '#082032' }}>
              <div style={{ width: '100%', height: '100%', background: '#1d4ed8', borderRadius: 2 }} />
            </div>
            <div style={{ padding: '3px 6px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {frozen.map(p => <ProjectCard key={p.id} project={p} onUpdate={onUpdate} compact />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
