import { spawn, spawnSync } from 'child_process'

// Resolve Python executable: env override → candidates in PATH order
function resolvePython(): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH
  const candidates = process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python']
  for (const cmd of candidates) {
    const result = spawnSync(cmd, ['-c', 'from markitdown import MarkItDown'], { encoding: 'utf-8' })
    if (result.status === 0) return cmd
  }
  // Fall back to first candidate and let the caller surface the error
  return candidates[0]
}

const PYTHON = resolvePython()

const SCRIPT = `
import sys, tempfile, os
from markitdown import MarkItDown

data = sys.stdin.buffer.read()
with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
    f.write(data)
    tmp_path = f.name

try:
    md = MarkItDown()
    result = md.convert(tmp_path)
    sys.stdout.write(result.text_content)
    sys.exit(0)
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
finally:
    os.unlink(tmp_path)
`

export async function parsePdfToMarkdown(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // -X utf8 forces UTF-8 I/O on Windows; stderr ignored (pdfminer FontBBox warnings are harmless)
    const py = spawn(PYTHON, ['-X', 'utf8', '-W', 'ignore', '-c', SCRIPT], {
      stdio: ['pipe', 'pipe', 'ignore'],
    })

    const chunks: Buffer[] = []

    py.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))

    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('markitdown: failed to convert PDF'))
        return
      }
      const raw = Buffer.concat(chunks).toString('utf-8')
      // Remove null bytes and other control characters that Postgres rejects
      const text = raw.replace(/\u0000/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
      const lines = text.split('\n')
      const cleaned = lines
        .map((line) => line.trim())
        .filter((line, i, arr) => {
          if (line === '' && arr[i - 1] === '') return false
          return true
        })
        .join('\n')
      resolve(cleaned)
    })

    py.on('error', (err) => reject(err))

    py.stdin.write(buffer)
    py.stdin.end()
  })
}
