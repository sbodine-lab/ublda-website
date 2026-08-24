export const CRAFT_NIGHT = {
  title: 'Board Craft Night',
  description:
    'Craft night at Sam and Andrew’s place with dinner, drinks, and group pics while we make the Festifall poster board. Drop in and leave whenever.',
} as const

export type CraftNightOption = {
  id: string
  weekday: string
  month: string
  day: string
  time: string
  tag?: string
}

export type CraftNightGroup = {
  id: string
  label: string
  options: CraftNightOption[]
}

export const CRAFT_NIGHT_GROUPS: CraftNightGroup[] = [
  {
    id: 'before-festifall',
    label: 'Craft night · before Festifall',
    options: [
      { id: 'fri-aug-28', weekday: 'Friday', month: 'Aug', day: '28', time: 'Starts 6:00 PM' },
      { id: 'sat-aug-29', weekday: 'Saturday', month: 'Aug', day: '29', time: 'Starts 4:30 PM' },
      { id: 'sun-aug-30', weekday: 'Sunday', month: 'Aug', day: '30', time: 'Starts 4:00 PM' },
    ],
  },
  {
    id: 'before-mtc',
    label: 'Round two · before BBA Meet the Clubs',
    options: [
      { id: 'thu-sep-3', weekday: 'Thursday', month: 'Sep', day: '3', time: 'Starts 5:30 PM' },
      { id: 'sun-sep-6', weekday: 'Sunday', month: 'Sep', day: '6', time: 'Starts 4:00 PM' },
      { id: 'mon-sep-7', weekday: 'Monday', month: 'Sep', day: '7', time: 'Starts 4:00 PM', tag: 'Labor Day, no classes' },
    ],
  },
]

export const CRAFT_NIGHT_OPTION_IDS = CRAFT_NIGHT_GROUPS.flatMap((group) =>
  group.options.map((option) => option.id),
)

export const CRAFT_NIGHT_ROSTER = [
  { name: 'Alex Forstner', email: 'alexfors@umich.edu' },
  { name: 'Alexa Chiang', email: 'atchiang@umich.edu' },
  { name: 'Andrew Sackett', email: 'andsack@umich.edu' },
  { name: 'Cooper Perry', email: 'cooperry@umich.edu' },
  { name: 'Landon Miller', email: 'landonem@umich.edu' },
  { name: 'Lindsey Ye', email: 'ylindsey@umich.edu' },
  { name: 'Sam Bodine', email: 'sbodine@umich.edu' },
  { name: 'Samantha Naber', email: 'snaber@umich.edu' },
  { name: 'Solomon Deyoung', email: 'sdeyoun@umich.edu' },
] as const

export type CraftNightRosterEmail = typeof CRAFT_NIGHT_ROSTER[number]['email']

export type CraftNightResponse = {
  name: string
  email: string
  available: string[]
  favorite: string | null
  note: string
  updatedAt: string
}

export type CraftNightPollStatus = 'open' | 'closed'

export type CraftNightPollState = {
  status: CraftNightPollStatus
  finalOptionId: string | null
  responses: CraftNightResponse[]
}

export const CRAFT_NIGHT_NOTE_MAX = 200
