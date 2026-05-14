import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  // Get client name from Supabase
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('client_name')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const fileName = `${data.client_name}.md`
  const url = `https://api.github.com/repos/Empowerbuilding/barnhaus-design-assistant/contents/projects/${encodeURIComponent(fileName)}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3.raw',
    },
    cache: 'no-store',
  })

  if (!res.ok) return NextResponse.json({ error: `File not found: ${fileName}` }, { status: 404 })

  const content = await res.text()
  return NextResponse.json({ content, fileName })
}
