import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/auth'

const handler = NextAuth(authOptions)
const disabledHandler = () => NextResponse.json({ error: 'Google sign-in is disabled in local mode.' }, { status: 404 })
const routeHandler = process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true' ? handler : disabledHandler

export { routeHandler as GET, routeHandler as POST }