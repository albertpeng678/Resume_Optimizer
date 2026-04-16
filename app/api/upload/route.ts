import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { parsePdfToMarkdown } from '@/lib/parsers/pdf'
import { parseDocxToMarkdown } from '@/lib/parsers/docx-parser'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
      const isImagePdf = file.type === 'application/pdf' && markdown.trim().length < 5
      return NextResponse.json(
        {
          error: isImagePdf
            ? '此 PDF 為圖片格式，無法擷取文字內容。請上傳含有可選取文字的 PDF，或改用 DOCX 格式。'
            : '無法從檔案中擷取足夠內容，請確認檔案是否正確。',
        },
        { status: 422 }
      )
    }

    // Validate content is a resume using LLM
    const validation = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `你是一個文件分類器。判斷以下文件內容是否為「履歷 / CV / Resume」。
履歷通常包含：個人資訊、工作經歷、學歷、技能等。
非履歷的例子：成績單、論文、報告、合約、信件等。

請以 JSON 格式回應：
{ "isResume": true 或 false, "reason": "一句話說明判斷理由" }`,
        },
        {
          role: 'user',
          content: markdown.slice(0, 1500),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }, { timeout: 15000 })

    const validationContent = validation.choices[0].message.content
    if (validationContent) {
      const result = JSON.parse(validationContent)
      if (!result.isResume) {
        return NextResponse.json(
          { error: `這不像是一份履歷。${result.reason || '請上傳你的履歷文件。'}` },
          { status: 422 }
        )
      }
    }

    return NextResponse.json({ markdown })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'File processing failed' }, { status: 500 })
  }
}
