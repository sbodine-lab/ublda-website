import type { VercelRequest, VercelResponse } from './types.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { canAccessRecruitingAdmin } from '../server/recruitingAdmin.ts'
import { buildRecruitingExport, parseRecruitingExportType } from '../server/recruitingExport.ts'
import {
  contentDisposition,
  methodNotAllowed,
  setApiSecurityHeaders,
  singleValue,
} from '../server/apiUtils.ts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'GET') {
    return methodNotAllowed(res)
  }

  const sessionToken = singleValue(req.query?.sessionToken).trim()
  const exportType = parseRecruitingExportType(singleValue(req.query?.type).trim())

  if (!exportType) {
    return res.status(400).json({ error: 'Choose a valid export type.' })
  }

  if (!await canAccessRecruitingAdmin(sessionToken)) {
    return res.status(401).json({ error: 'A recruiting admin session is required.' })
  }

  const dashboardData = await createLocalRecruitingStore().leadershipDashboardData()
  const csv = buildRecruitingExport(exportType, dashboardData)

  res.setHeader?.('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader?.('Content-Disposition', contentDisposition(csv.fileName, 'attachment'))
  return res.status(200).send(csv.content)
}
