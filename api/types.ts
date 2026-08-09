export type VercelRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  query?: Record<string, string | string[] | undefined>
  socket?: {
    remoteAddress?: string
  }
  url?: string
}

export type VercelResponse = {
  setHeader?: (name: string, value: string) => VercelResponse | void
  status: (code: number) => VercelResponse
  json: (body: unknown) => VercelResponse
  send: (body: unknown) => VercelResponse
}
