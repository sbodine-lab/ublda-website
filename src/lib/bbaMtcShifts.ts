import { CRAFT_NIGHT_ROSTER } from './craftNight.ts'

export const BBA_MTC_EVENT = {
  title: 'BBA Meet the Clubs',
  description: 'Pick every 30-minute block you can cover. Please aim for 30–60 minutes total.',
  details: 'Tuesday, September 8 · Table 11 · Main Winter Garden',
  note: 'Wear your UBLDA shirt during your shift. Totally fine to change if you are rushing another club.',
} as const

export const BBA_MTC_SHIFTS = [
  { id: '5-530', time: '5:00–5:30 PM', label: 'Setup' },
  { id: '530-6', time: '5:30–6:00 PM', label: 'Kickoff' },
  { id: '6-630', time: '6:00–6:30 PM', label: 'Main event' },
  { id: '630-7', time: '6:30–7:00 PM', label: 'Main event' },
  { id: '7-730', time: '7:00–7:30 PM', label: 'Main event' },
  { id: '730-8', time: '7:30–8:00 PM', label: 'Cleanup' },
] as const

export const BBA_MTC_SHIFT_IDS = BBA_MTC_SHIFTS.map((shift) => shift.id)
export const BBA_MTC_ROSTER = CRAFT_NIGHT_ROSTER

export type BbaMtcResponse = {
  name: string
  email: string
  shifts: string[]
  updatedAt: string
}

export type BbaMtcPollState = {
  responses: BbaMtcResponse[]
}
