import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { isWorkspacePayload, MAX_CSV_CHARACTERS } from '@/lib/workspace'

export const runtime = 'nodejs'
const syncEnabled = process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true'
const localWorkspacePath = path.join(process.cwd(), 'data', 'local-workspace.json')

async function readLocalWorkspace() {
  try {
    const payload: unknown = JSON.parse(await readFile(localWorkspacePath, 'utf8'))
    return isWorkspacePayload(payload) ? payload : null
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function parsePayload(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_CSV_CHARACTERS + 1_000_000) {
    return { error: NextResponse.json({ error: 'Fail terlalu besar. Pilih CSV yang lebih kecil.' }, { status: 413 }) }
  }

  try {
    const payload: unknown = await request.json()
    if (!isWorkspacePayload(payload)) {
      return { error: NextResponse.json({ error: 'Format data workspace tidak sah.' }, { status: 400 }) }
    }
    return { payload }
  } catch {
    return { error: NextResponse.json({ error: 'Data workspace tidak sah.' }, { status: 400 }) }
  }
}

export async function GET() {
  if (!syncEnabled) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Local shared storage is disabled in production.' }, { status: 503 })
    }
    try {
      return NextResponse.json({ payload: await readLocalWorkspace(), storage: 'local' })
    } catch {
      return NextResponse.json({ error: 'Gagal membaca simpanan local server.' }, { status: 500 })
    }
  }

  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 })

  const workspace = await prisma.userWorkspace.findUnique({ where: { userId } })
  return NextResponse.json({ payload: workspace?.payload ?? null, updatedAt: workspace?.updatedAt ?? null })
}

export async function PUT(request: Request) {
  if (!syncEnabled && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Local shared storage is disabled in production.' }, { status: 503 })
  }

  const parsed = await parsePayload(request)
  if ('error' in parsed) return parsed.error
  const payload = parsed.payload

  if (!syncEnabled) {
    try {
      const directory = path.dirname(localWorkspacePath)
      const temporaryPath = `${localWorkspacePath}.tmp`
      await mkdir(directory, { recursive: true })
      await writeFile(temporaryPath, JSON.stringify(payload), 'utf8')
      await rename(temporaryPath, localWorkspacePath)
      return NextResponse.json({ ok: true, storage: 'local' })
    } catch {
      return NextResponse.json({ error: 'Gagal menyimpan pada server tempatan.' }, { status: 500 })
    }
  }

  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 })

  try {
    const workspace = await prisma.userWorkspace.upsert({
      where: { userId },
      create: { userId, payload: payload as Prisma.InputJsonValue },
      update: { payload: payload as Prisma.InputJsonValue },
      select: { updatedAt: true },
    })
    return NextResponse.json({ ok: true, updatedAt: workspace.updatedAt })
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan data. Cuba lagi sebentar.' }, { status: 500 })
  }
}