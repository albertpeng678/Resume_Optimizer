import { extractText } from 'unpdf'

export async function parsePdfToMarkdown(buffer: Buffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })

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
