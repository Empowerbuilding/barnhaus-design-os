'use client'
import { useEffect, useState, useCallback } from 'react'
import type { Project, DesignPhase } from '@/lib/supabase'
import { PHASE_LABELS } from '@/lib/supabase'
import type { PhaseData } from '@/lib/card-utils'
import { getCardState } from '@/lib/card-utils'
import ProjectCard from '@/components/ProjectCard'
import WeeklyRibbon from '@/components/WeeklyRibbon'

type ProjectWithPhase = Project & { phase_data?: PhaseData | null }

const DISPLAY_PHASES: DesignPhase[] = ['concept_service','conceptual_design','draft_1','draft_2','draft_3','final_polish']

export default function Home() {
  const [projects, setProjects] = useState<ProjectWithPhase[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'burning' | 'frozen' | 'scheduled'>('all')
  const [ribbonOpen, setRibbonOpen] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/pipeline')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Pipeline fetch failed:', err)
      setProjects([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const activeProjects = projects.filter(p => p.current_phase !== 'archived')
  const burning = projects.filter(p => p.is_burning)
  const frozen = projects.filter(p => p.is_frozen)
  const scheduled = projects.filter(p => {
    const state = getCardState(p, p.phase_data)
    return state === 'scheduled'
  })

  const byPhase = (phase: DesignPhase) => {
    let ps = projects.filter(p => p.current_phase === phase)
    if (filter === 'burning') ps = ps.filter(p => p.is_burning)
    if (filter === 'frozen') ps = ps.filter(p => p.is_frozen)
    if (filter === 'scheduled') ps = ps.filter(p => getCardState(p, p.phase_data) === 'scheduled')
    return ps
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>

      {/* ── HEADER ────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid #1f2937', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#080808', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/barnhaus-logo.png" alt="Barnhaus" style={{ height: 32, width: 'auto', filter: 'none' }} />
          <span className="oswald" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.15em', color: 'white' }}>DESIGN OS</span>
          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            <span className="badge badge-red">{burning.length} 🔥</span>
            <span className="badge badge-blue">{frozen.length} 🧊</span>
            {scheduled.length > 0 && <span className="badge badge-purple">{scheduled.length} 🟣</span>}
            <span className="badge badge-gray">{activeProjects.length} active</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['all','burning','frozen','scheduled'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
              background: filter === f ? '#374151' : '#0f0f0f',
              color: filter === f ? '#fff' : '#6b7280',
              border: `1px solid ${filter === f ? '#4b5563' : '#1f2937'}`,
              fontFamily: 'Oswald, sans-serif', letterSpacing: '0.05em', textTransform: 'capitalize'
            }}>{f}</button>
          ))}
          <button onClick={load} style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
            background: refreshing ? '#1f2937' : '#0f0f0f',
            color: refreshing ? '#f59e0b' : '#6b7280',
            border: '1px solid #1f2937', fontFamily: 'Oswald', transition: 'all 0.15s'
          }}>{refreshing ? '⟳' : '↻'}</button>
          <button onClick={() => setRibbonOpen(r => !r)} style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
            background: '#0f0f0f', color: ribbonOpen ? '#f59e0b' : '#6b7280',
            border: `1px solid ${ribbonOpen ? '#92400e' : '#1f2937'}`, fontFamily: 'Oswald'
          }}>{ribbonOpen ? '▲ RIBBON' : '▼ RIBBON'}</button>
        </div>
      </div>

      {/* ── WEEKLY RIBBON (Layer 1) ───────────────────────────── */}
      {ribbonOpen && !loading && (
        <WeeklyRibbon projects={projects} onUpdate={load} />
      )}

      {/* ── PIPELINE BOARD (Layer 2) ──────────────────────────── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="oswald" style={{ color: '#374151', letterSpacing: '0.2em', fontSize: 14 }}>LOADING PIPELINE…</span>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', minHeight: 0 }}>
          {/* Active phase columns */}
          <div style={{ display: 'flex', overflowX: 'auto', flex: 1, alignItems: 'stretch' }}>
            {DISPLAY_PHASES.map(phase => {
              const ps = byPhase(phase)
              const allForPhase = projects.filter(p => p.current_phase === phase)
              return (
                <div key={phase}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = '#111' }}
                onDragLeave={e => { e.currentTarget.style.background = 'transparent' }}
                onDrop={async e => {
                  e.preventDefault()
                  e.currentTarget.style.background = 'transparent'
                  const projectId = e.dataTransfer.getData('projectId')
                  if (!projectId) return
                  await fetch(`/api/project/${projectId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ current_phase: phase })
                  })
                  await load()
                }}
                style={{
                  flexShrink: 0, width: 220,
                  borderRight: '1px solid #1a1a1a',
                  display: 'flex', flexDirection: 'column',
                  height: '100%', transition: 'background 0.15s'
                }}>
                  {/* Column header */}
                  <div style={{
                    padding: '8px 10px', borderBottom: '1px solid #1a1a1a',
                    background: '#080808', position: 'sticky', top: 0, zIndex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <span className="oswald" style={{ fontSize: 11, letterSpacing: '0.12em', color: '#6b7280', fontWeight: 600 }}>
                      {PHASE_LABELS[phase].toUpperCase()}
                    </span>
                    <span className="badge badge-gray" style={{ fontSize: 9 }}>{allForPhase.length}</span>
                  </div>
                  {/* Cards */}
                  <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
                    {ps.length === 0 ? (
                      <p style={{ fontSize: 10, color: '#1f2937', textAlign: 'center', paddingTop: 16 }}>—</p>
                    ) : (
                      ps.map(p => <ProjectCard key={p.id} project={p} onUpdate={load} />)
                    )}
                  </div>
                </div>
              )
            })}

            {/* Archived (dimmed) */}
            <div style={{ flexShrink: 0, width: 150, opacity: 0.35, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #1a1a1a', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="oswald" style={{ fontSize: 10, color: '#4b5563', letterSpacing: '0.12em' }}>ARCHIVED</span>
                <span className="badge badge-gray" style={{ fontSize: 9 }}>{projects.filter(p => p.current_phase === 'archived').length}</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {projects.filter(p => p.current_phase === 'archived').map(p => (
                  <div key={p.id} className="card" style={{ padding: '6px 8px' }}>
                    <p style={{ fontSize: 10, color: '#4b5563' }}>{p.client_name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
