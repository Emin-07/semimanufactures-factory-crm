import { spawn } from 'node:child_process'
import process from 'node:process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env into process.env so the API child process inherits the vars
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key) process.env[key] = val
  }
}

const isWin = process.platform === 'win32'
const nodeCmd = process.execPath
const npmCmd = isWin ? 'npm.cmd' : 'npm'
const children = new Set()
let shuttingDown = false
let apiExited = false

function prefixStream(label, stream, output) {
  stream.on('data', chunk => {
    const text = chunk.toString()
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) output.write(`[${label}] ${line}\n`)
    }
  })
}

function run(label, cmd, args, options = {}) {
  if (shuttingDown) return null

  const child = spawn(cmd, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: options.shell ?? false,
  })

  children.add(child)
  prefixStream(label, child.stdout, process.stdout)
  prefixStream(label, child.stderr, process.stderr)

  child.on('error', err => {
    if (shuttingDown) return
    console.error(`[dev] failed to start ${label}: ${err.message}`)
    shutdown(1)
  })

  child.on('exit', (code, signal) => {
    children.delete(child)
    if (label === 'api') apiExited = true
    if (shuttingDown) return
    const reason = signal ? `signal ${signal}` : `code ${code}`
    console.error(`[dev] ${label} stopped with ${reason}`)
    if (label === 'api') {
      console.error('[dev] API crashed. If the log mentions better_sqlite3.node, reinstall native deps:')
      console.error('[dev]   npm config set ignore-scripts false')
      console.error('[dev]   Remove-Item -Recurse node_modules, package-lock.json')
      console.error('[dev]   npm install')
      console.error('[dev]   npm rebuild better-sqlite3')
    }
    shutdown(code || 1)
  })

  return child
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) {
      try { child.kill(isWin ? undefined : 'SIGTERM') } catch {}
    }
  }
  setTimeout(() => process.exit(code), 250).unref()
}

async function waitForApi(url, timeoutMs = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (shuttingDown || apiExited) return false
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  return false
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('[dev] Starting Express API on http://127.0.0.1:3000')
run('api', nodeCmd, ['server.js'])

const ok = await waitForApi('http://127.0.0.1:3000/api/health')
if (!ok) {
  if (!shuttingDown) {
    console.error('[dev] API did not become healthy within 15s. Vite will not be started.')
    shutdown(1)
  }
} else if (!shuttingDown) {
  console.log('[dev] API is healthy')
  console.log('[dev] Starting Vite on http://127.0.0.1:5173')
  run('vite', npmCmd, ['run', 'dev:vite'], { shell: isWin })
}
