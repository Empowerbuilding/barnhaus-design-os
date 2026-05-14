'use client'
import { useState, useEffect, useRef } from 'react'

interface MicroTask {
  id: string
  project_id: string | null
  description: string
  source: string
  done: boolean
  created_at: string
  project_name?: string
}

interface Props {
  onUpdate?: () => void
}

export default function MicroTaskPanel({ onUpdate }: Props) {
  const [tasks, setTasks] = useState<MicroTask[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchTasks = async () => {
    const res = await fetch('/api/tasks')
    if (res.ok) setTasks(await res.json())
  }

  useEffect(() => { fetchTasks() }, [])

  const handleAdd = async () => {
    if (!input.trim()) return
    setAdding(true)
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: input.trim(), source: 'manual' })
    })
    setInput('')
    await fetchTasks()
    setAdding(false)
    if (onUpdate) onUpdate()
  }

  const handleDone = async (id: string) => {
    setLoading(true)
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: true })
    })
    // Burst animation then remove
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: true } : t))
    setTimeout(async () => {
      await fetchTasks()
      setLoading(false)
      if (onUpdate) onUpdate()
    }, 400)
  }

  const open = tasks.filter(t => !t.done)
  const grouped = open.reduce((acc, t) => {
    const key = t.project_name || 'General'
    acc[key] = acc[key] || []
    acc[key].push(t)
    return acc
  }, {} as Record<string, MicroTask[]>)

  return (
    <div style={{
      width: 240, flexShrink: 0, background: '#0a0a0a', border: '1px solid #1f2937',
      borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%'
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1f2937', flexShrink: 0 }}>
        <span className="oswald" style={{ fontSize: 11, letterSpacing: '0.15em', color: '#6b7280' }}>TASKS</span>
        {open.length > 0 && (
          <span style={{
            marginLeft: 8, fontSize: 9, background: '#374151', color: '#9ca3af',
            borderRadius: 10, padding: '1px 6px', fontFamily: 'Oswald'
          }}>{open.length}</span>
        )}
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {Object.keys(grouped).length === 0 && (
          <p style={{ fontSize: 10, color: '#374151', padding: '8px 12px', fontStyle: 'italic' }}>No open tasks</p>
        )}
        {Object.entries(grouped).map(([project, ptasks]) => (
          <div key={project}>
            {Object.keys(grouped).length > 1 && (
              <div style={{ padding: '4px 12px 2px', fontSize: 9, color: '#4b5563', fontFamily: 'Oswald', letterSpacing: '0.1em' }}>
                {project.toUpperCase()}
              </div>
            )}
            {ptasks.map(task => (
              <div
                key={task.id}
                className={task.done ? 'checkbox-burst-anim' : ''}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '5px 12px', cursor: 'pointer',
                  opacity: task.done ? 0.4 : 1, transition: 'opacity 0.3s'
                }}
                onClick={() => !task.done && handleDone(task.id)}
              >
                <div style={{
                  width: 13, height: 13, borderRadius: 3, border: '1px solid #374151',
                  background: task.done ? '#22c55e' : 'transparent', flexShrink: 0, marginTop: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s'
                }}>
                  {task.done && <span style={{ fontSize: 8, color: '#fff' }}>✓</span>}
                </div>
                <span style={{ fontSize: 11, color: task.done ? '#4b5563' : '#d1d5db', lineHeight: 1.4, flex: 1 }}>
                  {task.description}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Add task input */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1f2937', flexShrink: 0 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Add task…"
          style={{
            width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 4,
            padding: '5px 8px', fontSize: 11, color: '#d1d5db', outline: 'none',
            fontFamily: 'inherit'
          }}
        />
        {input && (
          <button
            onClick={handleAdd}
            disabled={adding}
            style={{
              marginTop: 4, width: '100%', background: '#1f2937', border: 'none', borderRadius: 4,
              padding: '4px', fontSize: 10, color: '#9ca3af', cursor: 'pointer', fontFamily: 'Oswald',
              letterSpacing: '0.1em'
            }}
          >
            {adding ? '…' : '+ ADD'}
          </button>
        )}
      </div>
    </div>
  )
}
