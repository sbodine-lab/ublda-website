export const formatSpeakerTime = (value: string, timeZone: string): string | null => {
  if (!value || !timeZone.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(date)
  } catch {
    return null
  }
}

export const formatAnnArborTime = (value: string) => (
  formatSpeakerTime(value, 'America/Detroit') || value || '—'
)
