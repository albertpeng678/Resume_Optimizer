import { spawn } from 'child_process'
import path from 'path'

// Use absolute path to avoid PATH issues when spawned from Next.js server
const PYTHON = '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3'

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
    // stderr is intentionally ignored — pdfminer emits FontBBox warnings that are harmless
    const py = spawn(PYTHON, ['-W', 'ignore', '-c', SCRIPT], {
      stdio: ['pipe', 'pipe', 'ignore'],
    })

    const chunks: Buffer[] = []

    py.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))

    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('markitdown: failed to convert PDF'))
        return
      }
      const text = Buffer.concat(chunks).toString('utf-8')
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
