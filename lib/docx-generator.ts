import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } from 'docx'

export interface ResumeSection {
  title: string
  content: string
}

export async function generateDocx(
  name: string,
  sections: ResumeSection[]
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: name,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
  ]

  for (const section of sections) {
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400 },
      })
    )
    const lines = section.content.split('\n').filter(l => l.trim())
    for (const line of lines) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 24 })],
          spacing: { after: 100 },
        })
      )
    }
  }

  const doc = new Document({ sections: [{ children }] })
  return await Packer.toBuffer(doc) as unknown as Buffer
}
