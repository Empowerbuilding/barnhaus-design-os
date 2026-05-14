import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('micro_tasks')
    .select('*, projects(client_name)')
    .eq('done', false)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tasks = (data || []).map((t: Record<string, unknown> & { projects?: { client_name?: string } | null }) => ({
    ...t,
    project_name: t.projects?.client_name || null,
    projects: undefined
  }))

  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { description, source = 'manual', project_id = null } = body

  if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('micro_tasks')
    .insert({ description, source, project_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
