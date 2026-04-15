import mammoth from 'mammoth'

export async function parseDocxToMarkdown(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  const text = result.value

  const lines = text.split('\n')
  const cleaned = lines
    .map((line: string) => line.trim())
    .filter((line: string, i: number, arr: string[]) => {
      if (line === '' && arr[i - 1] === '') return false
      return true
    })
    .join('\n')

  return cleaned
}
