declare module 'mammoth' {
  interface MammothOptions {
    buffer?: Buffer
    path?: string
  }
  interface MammothResult {
    value: string
    messages: Array<{ type: string; message: string }>
  }
  function extractRawText(options: MammothOptions): Promise<MammothResult>
  function convertToHtml(options: MammothOptions): Promise<MammothResult>
}
