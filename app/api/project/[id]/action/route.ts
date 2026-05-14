import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PHASE_DURATION, getChecklist } from '@/lib/card-utils'

// Cascade: when a box is checked, all preceding boxes in the phase checklist are also checked
function getCascadeFields(field: string, phase_name: string): Record<string, boolean> {
  const items = getChecklist(phase_name)
  const idx = items.findIndex(i => i.field === field)
  if (idx <= 0) return {}
  const cascade: Record<string, boolean> = {}
  for (let i = 0; i < idx; i++) {
    cascade[items[i].field] = true
  }
  return cascade
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { action, phase_name, field, value } = body
  const now = new Date().toISOString()

  if (action === 'check') {
    // Build upsert payload — include cascade if checking a box
    const cascadeFields = value === true ? getCascadeFields(field, phase_name) : {}
    const upsertPayload = {
      project_id: params.id,
      phase_name,
      ...cascadeFields,
      [field]: value,
      updated_at: now,
    }

    await supabaseAdmin.from('project_phases').upsert(
      upsertPayload,
      { onConflict: 'project_id,phase_name' }
    )

    const cascadeCount = Object.keys(cascadeFields).length
    await supabaseAdmin.from('project_activity').insert({
      project_id: params.id, event_type: 'TASK_CHECK',
      description: cascadeCount > 0
        ? `${field} → ${value} (cascaded ${cascadeCount} preceding box${cascadeCount > 1 ? 'es' : ''})`
        : `${field} → ${value}`
    })

    let handUpdate: Record<string, unknown> | null = null

    if (field === 'review_held' && value === true) {
      // Meeting held: ticker starts NOW at phase duration. Hand → designer.
      const duration = PHASE_DURATION[phase_name] ?? 14
      handUpdate = {
        current_hand: 'designer',
        ticker_start_date: now,
        ticker_duration_days: duration,
        updated_at: now,
      }
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'AUTO_FLIP',
        description: `Review held → Designer hand, ${duration}d ticker starts`
      })
    } else if (field === 'handoff_pending' && value === true) {
      handUpdate = { current_hand: 'upworker', updated_at: now }
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'AUTO_FLIP',
        description: 'Handoff to Upworker — ticker unchanged'
      })
    } else if (field === 'polishing' && value === true) {
      handUpdate = { current_hand: 'designer', updated_at: now }
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'AUTO_FLIP',
        description: 'Polishing — back to Designer, ticker unchanged'
      })
    } else if (field === 'draft_delivered' && value === true) {
      handUpdate = { current_hand: 'client', ticker_start_date: now, updated_at: now }
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'AUTO_FLIP',
        description: 'Draft delivered → Client hand'
      })
    } else if (field === 'review_scheduled' && value === true) {
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'SCHEDULED',
        description: 'Review scheduled — card turns purple'
      })
    }

    if (handUpdate) {
      await supabaseAdmin.from('projects').update(handUpdate).eq('id', params.id)
    }

    return NextResponse.json({
      ok: true,
      auto_flip: !!handUpdate,
      new_hand: handUpdate?.current_hand ?? null,
      cascaded: Object.keys(cascadeFields)
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
