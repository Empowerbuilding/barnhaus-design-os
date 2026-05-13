'use client'
import { useEffect, useState, useCallback } from 'react'
import type { Project, DesignPhase } from '@/lib/supabase'
import { PHASE_LABELS } from '@/lib/supabase'
import ProjectCard from '@/components/ProjectCard'

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [agendaOpen, setAgendaOpen] = useState(true)
  const [filter, setFilter] = useState<'all' | 'burning' | 'frozen'>('all')

  const load = useCallback(async () => {
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
    }
  }, [])

  useEffect(() => { load() }, [load])

  const byPhase = (phase: DesignPhase) => projects.filter(p => p.current_phase === phase)
  const burning = projects.filter(p => p.is_burning)
  const frozen = projects.filter(p => p.is_frozen)
  const active = projects.filter(p => p.current_phase !== 'archived')

  const displayPhases: DesignPhase[] = ['concept_service','conceptual_design','draft_1','draft_2','draft_3','final_polish']

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
          <img src="/barnhaus-logo.png" alt="Barnhaus" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
          <h1 className="oswald text-2xl font-bold tracking-widest text-white">SOLITAIRE</h1>
        </div>
          <div className="flex gap-2">
            <span className="badge badge-red">{burning.length} 🔥 Burning</span>
            <span className="badge badge-blue">{frozen.length} 🧊 Frozen</span>
            <span className="badge badge-gray">{active.length} Active</span>
          </div>
        </div>
        <div className="flex gap-2">
          {(['all','burning','frozen'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded capitalize transition-colors ${filter === f ? 'bg-gray-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
              {f}
            </button>
          ))}
          <button onClick={load} className="text-xs px-3 py-1.5 bg-gray-900 text-gray-400 hover:bg-gray-800 rounded transition-colors">↻ Refresh</button>
        </div>
      </div>

      {/* Agenda strip */}
      {(burning.length > 0 || frozen.length > 0) && (
        <div className="border-b border-red-900 bg-red-950/20">
          <button onClick={() => setAgendaOpen(!agendaOpen)}
            className="w-full px-6 py-2 flex items-center gap-3 text-left">
            <span className="text-xs font-bold text-red-400 oswald tracking-wider">⚡ AGENDA — NEEDS ATTENTION</span>
            <span className="text-xs text-gray-600">{agendaOpen ? '▲ collapse' : '▼ expand'}</span>
          </button>
          {agendaOpen && (
            <div className="px-6 pb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {burning.map(p => (
                <div key={p.id} className="card burning p-2">
                  <p className="oswald text-sm font-semibold">{p.client_name}</p>
                  <p className="text-xs text-red-400">{PHASE_LABELS[p.current_phase]} — {Math.abs(p.countdown_ticker ?? 0)}d overdue</p>
                </div>
              ))}
              {frozen.map(p => (
                <div key={p.id} className="card frozen p-2">
                  <p className="oswald text-sm font-semibold">{p.client_name}</p>
                  <p className="text-xs text-blue-300">{PHASE_LABELS[p.current_phase]} — {p.wait_ticker}d with client</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main pipeline board */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 oswald tracking-widest">LOADING PIPELINE...</p>
        </div>
      ) : (
        <div className="flex gap-0 overflow-x-auto h-[calc(100vh-140px)]">
          {displayPhases.map(phase => {
            let phaseProjects = byPhase(phase)
            if (filter === 'burning') phaseProjects = phaseProjects.filter(p => p.is_burning)
            if (filter === 'frozen') phaseProjects = phaseProjects.filter(p => p.is_frozen)

            return (
              <div key={phase} className="flex-shrink-0 w-64 border-r border-gray-800 flex flex-col">
                {/* Column header */}
                <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between sticky top-0" style={{ background: '#0a0a0a' }}>
                  <h2 className="oswald text-sm font-semibold tracking-wider text-gray-300">{PHASE_LABELS[phase].toUpperCase()}</h2>
                  <span className="badge badge-gray text-xs">{byPhase(phase).length}</span>
                </div>
                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {phaseProjects.length === 0 ? (
                    <p className="text-xs text-gray-700 text-center pt-4">empty</p>
                  ) : (
                    phaseProjects.map(p => (
                      <ProjectCard key={p.id} project={p} onUpdate={load} />
                    ))
                  )}
                </div>
              </div>
            )
          })}

          {/* Archived column */}
          <div className="flex-shrink-0 w-48 flex flex-col opacity-50">
            <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between sticky top-0" style={{ background: '#0a0a0a' }}>
              <h2 className="oswald text-xs font-semibold tracking-wider text-gray-500">ARCHIVED</h2>
              <span className="badge badge-gray">{byPhase('archived').length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {byPhase('archived').map(p => (
                <div key={p.id} className="card p-2 opacity-50">
                  <p className="text-xs text-gray-500">{p.client_name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
