import { NextRequest, NextResponse } from 'next/server'
import { parsePdfToMarkdown } from '@/lib/parsers/pdf'
import { parseDocxToMarkdown } from '@/lib/parsers/docx-parser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only PDF and DOCX files are supported' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let markdown: string

    if (file.type === 'application/pdf') {
      markdown = await parsePdfToMarkdown(buffer)
    } else {
      markdown = await parseDocxToMarkdown(buffer)
    }

    if (!markdown || markdown.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract meaningful content from file' },
        { status: 422 }
      )
    }

    return NextResponse.json({ markdown })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'File processing failed' }, { status: 500 })
  }
}
