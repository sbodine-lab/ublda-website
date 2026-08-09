import type { DashboardData } from '../src/lib/dashboardData.ts'
import { getInterviewSlotByValue, sortSlotValues } from '../src/lib/interviews.ts'

export type RecruitingExportType = 'candidates' | 'interviewers'

const csvCell = (value: unknown) => {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim()
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const toCsv = (headers: string[], rows: unknown[][]) => (
  [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')
    .concat('\n')
)

const slotLabel = (slotValue: string) => {
  const slot = getInterviewSlotByValue(slotValue)
  return slot ? slot.label : slotValue
}

export const parseRecruitingExportType = (value: string): RecruitingExportType | null => {
  if (value === 'candidates' || value === 'interviewers') return value
  return null
}

export const buildRecruitingExport = (type: RecruitingExportType, data: DashboardData) => {
  if (type === 'interviewers') {
    return {
      fileName: 'ublda-interviewer-availability.csv',
      content: toCsv(
        ['name', 'email', 'role', 'max_interviews', 'availability_count', 'availability', 'notes', 'updated_at'],
        (data.interviewerAvailability || []).map((interviewer) => [
          interviewer.name,
          interviewer.email || '',
          interviewer.role,
          interviewer.maxInterviews,
          interviewer.availability.length,
          sortSlotValues(interviewer.availability).map(slotLabel).join('; '),
          interviewer.notes || '',
          interviewer.updatedAt || '',
        ]),
      ),
    }
  }

  return {
    fileName: 'ublda-interview-candidates.csv',
    content: toCsv(
      [
        'name',
        'email',
        'program',
        'status',
        'assigned_slot',
        'interviewers',
        'first_choice',
        'second_choice',
        'third_choice',
        'resume_url',
        'notes',
      ],
      (data.candidates || []).map((candidate) => [
        candidate.name,
        candidate.email,
        candidate.program,
        candidate.status,
        slotLabel(candidate.assignedSlot),
        candidate.interviewers.join('; '),
        candidate.rolePreferences[0] || '',
        candidate.rolePreferences[1] || '',
        candidate.rolePreferences[2] || '',
        candidate.resumeUrl,
        candidate.feedback,
      ]),
    ),
  }
}
