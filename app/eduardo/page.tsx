'use client'
import { useEffect, useState, useCallback } from 'react'
import type { Project, DesignPhase } from '@/lib/supabase'
import { PHASE_LABELS } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
import type { PhaseData } from '@/lib/card-utils'

import ProjectCard from '@/components/ProjectCard'
import WeeklyRibbon from '@/components/WeeklyRibbon'

type ProjectWithPhase = Project & { phase_data?: PhaseData | null }

const DISPLAY_PHASES: DesignPhase[] = ['concept_service','conceptual_design','draft_1','draft_2','draft_3','final_polish']

export default function EduardoPage() {
  const [allProjects, setAllProjects] = useState<ProjectWithPhase[]>([])
  const [loading, setLoading] = useState(true)
  const [ribbonOpen, setRibbonOpen] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/pipeline', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const all = Array.isArray(data) ? data : []
      // Only show Eduardo's projects
      setAllProjects(all.filter((p: ProjectWithPhase) => p.assigned_to === 'eduardo' || p.assigned_to === 'both'))
    } catch (err) {
      console.error('Pipeline fetch failed:', err)
      setAllProjects([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabaseBrowser
      .channel('eduardo-pipeline-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_phases' }, () => load())
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [load])

  const activeProjects = allProjects.filter(p => p.current_phase !== 'archived')
  const burning = allProjects.filter(p => p.is_burning)
  const frozen = allProjects.filter(p => p.is_frozen)

  const byPhase = (phase: DesignPhase) => allProjects.filter(p => p.current_phase === phase)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div style={{ borderBottom: '1px solid #1f2937', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#080808', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/barnhaus-logo.png" alt="Barnhaus" style={{ height: 32, width: 'auto' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="oswald" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.15em', color: 'white' }}>DESIGN OS</span>
            <span className="oswald" style={{ fontSize: 11, letterSpacing: '0.2em', color: '#B8860B', fontWeight: 600, marginTop: -2 }}>EDUARDO — MY PROJECTS</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            <span className="badge badge-red">{burning.length} 🔥</span>
            <span className="badge badge-blue">{frozen.length} 🧊</span>
            <span className="badge badge-gray">{activeProjects.length} active</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ribbonOpen && !loading && (
            <WeeklyRibbon projects={allProjects} onUpdate={load} />
          )}

          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="oswald" style={{ color: '#374151', letterSpacing: '0.2em', fontSize: 14 }}>LOADING…</span>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', minHeight: 0 }}>
              <div style={{ display: 'flex', overflowX: 'auto', flex: 1, alignItems: 'stretch' }}>
                {DISPLAY_PHASES.map(phase => {
                  const ps = byPhase(phase)
                  return (
                    <div key={phase} style={{
                      flexShrink: 0, width: 220,
                      borderRight: '1px solid #1a1a1a',
                      display: 'flex', flexDirection: 'column', height: '100%'
                    }}>
                      <div style={{
                        padding: '8px 10px', borderBottom: '1px solid #1a1a1a',
                        background: '#080808', position: 'sticky', top: 0, zIndex: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}>
                        <span className="oswald" style={{ fontSize: 11, letterSpacing: '0.12em', color: '#6b7280', fontWeight: 600 }}>
                          {PHASE_LABELS[phase].toUpperCase()}
                        </span>
                        <span className="badge badge-gray" style={{ fontSize: 9 }}>{ps.length}</span>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {ps.length === 0 ? (
                          <p style={{ fontSize: 10, color: '#1f2937', textAlign: 'center', paddingTop: 16 }}>—</p>
                        ) : (
                          ps.map(p => <ProjectCard key={p.id} project={p} onUpdate={load} />)
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
