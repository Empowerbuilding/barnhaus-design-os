'use client'
import { useState } from 'react'
import type { Project, ProjectPhase, Activity, DesignPhase, HandOwnership } from '@/lib/supabase'
import { PHASES, PHASE_LABELS } from '@/lib/supabase'

interface Props {
  project: Project
  onUpdate: () => void
}

const HAND_LABELS: Record<HandOwnership, string> = { designer: '🟢 Designer', upworker: '🟡 Upworker', client: '🔵 Client' }
const HAND_CLASSES: Record<HandOwnership, string> = { designer: 'designer', upworker: 'upworker', client: 'client' }

function TickerDisplay({ p }: { p: Project }) {
  if (p.is_burning) {
    const overdue = p.countdown_ticker !== null ? Math.abs(p.countdown_ticker) : 0
    return <span className="text-red-400 font-bold text-xs">🔥 {overdue}d OVERDUE</span>
  }
  if (p.is_frozen) {
    return <span className="text-blue-300 text-xs">🧊 {p.wait_ticker}d frozen</span>
  }
  if (p.countdown_ticker !== null) {
    const color = p.countdown_ticker <= 3 ? 'text-yellow-400' : 'text-green-400'
    return <span className={`text-xs font-semibold ${color}`}>{p.countdown_ticker}d left</span>
  }
  if (p.wait_ticker !== null) {
    return <span className="text-blue-400 text-xs">waiting {p.wait_ticker}d</span>
  }
  return null
}

export default function ProjectCard({ project: p, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [newHand, setNewHand] = useState<HandOwnership>(p.current_hand)
  const [newPhase, setNewPhase] = useState<DesignPhase>(p.current_phase)

  const toggle = async () => {
    if (!expanded && phases.length === 0) {
      setLoading(true)
      const res = await fetch(`/api/project/${p.id}`)
      const data = await res.json()
      setPhases(data.phases || [])
      setActivity(data.activity || [])
      setLoading(false)
    }
    setExpanded(!expanded)
  }

  const doAction = async (action: string, extra?: object) => {
    setLoading(true)
    await fetch(`/api/project/${p.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, phase_name: p.current_phase, ...extra })
    })
    onUpdate()
    setLoading(false)
  }

  const doUpdate = async (update: object) => {
    setLoading(true)
    await fetch(`/api/project/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    })
    onUpdate()
    setLoading(false)
  }

  const cardClass = `card cursor-pointer transition-all duration-200 hover:border-gray-600 ${
    p.is_burning ? 'burning' : p.is_frozen ? 'frozen' : HAND_CLASSES[p.current_hand]
  }`

  const curPhase = phases.find(ph => ph.phase_name === p.current_phase)

  return (
    <div className={cardClass} onClick={toggle}>
      {/* Collapsed header */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="oswald font-semibold text-sm tracking-wide leading-tight">{p.client_name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-gray-400">{HAND_LABELS[p.current_hand]}</span>
              <TickerDisplay p={p} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {p.engineering_required && <span className="badge badge-gray">ENG</span>}
            {p.referral_status === 'pending' && <span className="badge badge-yellow">REF</span>}
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div onClick={e => e.stopPropagation()} className="mt-3 border-t border-gray-800 pt-3 space-y-3">
            {loading && <p className="text-xs text-gray-500">Loading...</p>}

            {/* Notes */}
            {p.notes && <p className="text-xs text-gray-400 leading-relaxed">{p.notes}</p>}

            {/* Contact */}
            {p.client_email && <p className="text-xs text-gray-500">{p.client_email}</p>}

            {/* Checklist */}
            {curPhase && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Checklist</p>
                {(['review_scheduled','review_held','handoff_pending','draft_delivered'] as const).map(field => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={curPhase[field]} onChange={e =>
                      doAction('check', { field, value: e.target.checked })
                    } className="accent-green-500" />
                    <span className="text-xs text-gray-300 capitalize">{field.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => doAction('deliver')}
                  className="text-xs px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-blue-100 rounded transition-colors">
                  📤 Mark Delivered
                </button>
                <button onClick={() => doAction('review_held')}
                  className="text-xs px-3 py-1.5 bg-green-900 hover:bg-green-800 text-green-100 rounded transition-colors">
                  ✅ Review Held
                </button>
              </div>

              {/* Flip hand */}
              <div className="flex items-center gap-2">
                <select value={newHand} onChange={e => setNewHand(e.target.value as HandOwnership)}
                  className="text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-200">
                  <option value="designer">🟢 Designer</option>
                  <option value="upworker">🟡 Upworker</option>
                  <option value="client">🔵 Client</option>
                </select>
                <button onClick={() => doUpdate({ current_hand: newHand })}
                  className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded transition-colors">
                  Flip Hand
                </button>
              </div>

              {/* Next phase */}
              <div className="flex items-center gap-2">
                <select value={newPhase} onChange={e => setNewPhase(e.target.value as DesignPhase)}
                  className="text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-200">
                  {PHASES.map(ph => <option key={ph} value={ph}>{PHASE_LABELS[ph]}</option>)}
                </select>
                <button onClick={() => doUpdate({ current_phase: newPhase })}
                  className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded transition-colors">
                  Set Phase
                </button>
              </div>
            </div>

            {/* Activity */}
            {activity.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Activity</p>
                {activity.map(a => (
                  <p key={a.id} className="text-xs text-gray-500">
                    <span className="text-gray-600">{new Date(a.created_at).toLocaleDateString()}</span> {a.description}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
