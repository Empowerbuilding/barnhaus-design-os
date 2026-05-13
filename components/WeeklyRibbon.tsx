'use client'
import { useMemo } from 'react'
import type { Project } from '@/lib/supabase'
import { getCardState, PHASE_WEIGHT, type PhaseData } from '@/lib/card-utils'
import ProjectCard from './ProjectCard'

type ProjectWithPhase = Project & { phase_data?: PhaseData | null }

interface Props {
  projects: ProjectWithPhase[]
  onUpdate: () => void
}

function getWeekDays(): { date: Date; label: string; key: string; isToday: boolean }[] {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const isToday = d.toDateString() === now.toDateString()
    return {
      date: d,
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
      key: d.toDateString(),
      isToday,
    }
  })
}

function slotProjectToDay(p: ProjectWithPhase, days: ReturnType<typeof getWeekDays>): string | null {
  const state = getCardState(p, p.phase_data)
  const todayKey = days.find(d => d.isToday)?.key || days[0].key

  // Burning → today
  if (state === 'burn') return todayKey

  // Scheduled (review booked) → today or nearest future day
  if (state === 'scheduled') return todayKey

  // Close to deadline (designer/upworker, ticker 0-3) → slot into expected day
  if ((state === 'designer' || state === 'upworker') && p.countdown_ticker !== null) {
    if (p.countdown_ticker <= 0) return todayKey
    if (p.countdown_ticker <= 6) {
      const targetDay = days.find((_, i) => i === p.countdown_ticker!)
      return targetDay?.key || null
    }
  }

  return null
}

export default function WeeklyRibbon({ projects, onUpdate }: Props) {
  const days = useMemo(() => getWeekDays(), [])
  const activeProjects = projects.filter(p => p.current_phase !== 'archived')

  // Build day → projects map
  const dayMap = useMemo(() => {
    const map: Record<string, ProjectWithPhase[]> = {}
    days.forEach(d => { map[d.key] = [] })
    activeProjects.forEach(p => {
      const key = slotProjectToDay(p, days)
      if (key && map[key]) map[key].push(p)
    })
    return map
  }, [activeProjects, days])

  // Frozen projects (separate section at end)
  const frozen = activeProjects.filter(p => getCardState(p, p.phase_data) === 'freeze')

  // Load bar calculation per day
  const loadForDay = (key: string) => {
    const ps = dayMap[key] || []
    if (!ps.length) return 0
    const total = ps.reduce((sum, p) => sum + (PHASE_WEIGHT[p.current_phase] || 0), 0)
    return Math.min(total / 2.5, 1) // cap at 100% (2.5 = full load)
  }

  const loadColor = (load: number) => {
    if (load > 0.8) return '#ef4444'
    if (load > 0.5) return '#f59e0b'
    return '#22c55e'
  }

  return (
    <div style={{ borderBottom: '2px solid #1f2937', background: '#080808' }}>
      {/* Ribbon header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-900">
        <span className="oswald" style={{ fontSize: 11, color: '#4b5563', letterSpacing: '0.15em' }}>WEEKLY RIBBON</span>
        <span className="badge badge-amber" style={{ fontSize: 9 }}>ACTIVE WORKSPACE</span>
        {frozen.length > 0 && (
          <span className="badge badge-blue" style={{ fontSize: 9 }}>+{frozen.length} frozen →</span>
        )}
      </div>

      {/* 7-day strip + frozen */}
      <div className="flex overflow-x-auto" style={{ minHeight: 90 }}>
        {days.map(day => {
          const ps = dayMap[day.key] || []
          const load = loadForDay(day.key)
          return (
            <div key={day.key} className={`ribbon-day${day.isToday ? ' today' : ''}`} style={{ padding: '6px 0 4px' }}>
              {/* Day label */}
              <div style={{ padding: '0 8px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="oswald" style={{
                  fontSize: 10, letterSpacing: '0.08em',
                  color: day.isToday ? '#f59e0b' : '#4b5563',
                  fontWeight: day.isToday ? 700 : 400
                }}>
                  {day.isToday ? '● TODAY' : day.label.split(',')[0]}
                </span>
                {ps.length > 0 && (
                  <span style={{ fontSize: 9, color: '#4b5563' }}>{ps.length}</span>
                )}
              </div>

              {/* Load bar */}
              <div className="load-bar-track">
                <div className="load-bar-fill" style={{ width: `${load * 100}%`, background: loadColor(load) }} />
              </div>

              {/* Cards */}
              <div style={{ padding: '2px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ps.length === 0 ? (
                  <div style={{ fontSize: 10, color: '#1f2937', textAlign: 'center', paddingTop: 8 }}>—</div>
                ) : (
                  ps.map(p => (
                    <ProjectCard key={p.id} project={p} onUpdate={onUpdate} compact={true} />
                  ))
                )}
              </div>
            </div>
          )
        })}

        {/* Frozen column */}
        {frozen.length > 0 && (
          <div style={{ flexShrink: 0, width: 140, borderLeft: '1px solid #1f2937', padding: '6px 0 4px' }}>
            <div style={{ padding: '0 8px 4px' }}>
              <span className="oswald" style={{ fontSize: 10, color: '#3b82f6', letterSpacing: '0.08em' }}>🧊 FROZEN</span>
            </div>
            <div className="load-bar-track" style={{ background: '#082032' }}>
              <div style={{ width: '100%', height: '100%', background: '#38bdf8', borderRadius: 2 }} />
            </div>
            <div style={{ padding: '2px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {frozen.map(p => (
                <ProjectCard key={p.id} project={p} onUpdate={onUpdate} compact={true} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
