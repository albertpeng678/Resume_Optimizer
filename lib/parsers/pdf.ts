import { PDFParse } from 'pdf-parse'

export async function parsePdfToMarkdown(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  const result = await parser.getText()
  const text = result.text

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
