import type { Candidate, InterviewerAvailability } from './memberData.ts'
import { sortSlotValues } from './interviews.ts'

export type InterviewerAvoidance = Record<string, string[]>

export type InterviewMatch = {
  assignedSlot: string
  interviewers: string[]
  overlapCount: number
}

const openMatchStatuses = new Set<Candidate['status']>(['Needs match', 'Matched'])

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

const parseCapacity = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }

  return fallback
}

export const interviewerLoadMap = (candidates: Candidate[], ignoredCandidateId = '') => (
  candidates.reduce<Record<string, number>>((loads, candidate) => {
    if (candidate.id === ignoredCandidateId) return loads
    if (!candidate.assignedSlot) return loads

    candidate.interviewers.forEach((interviewer) => {
      loads[interviewer] = (loads[interviewer] || 0) + 1
    })

    return loads
  }, {})
)

export const matchInterviewCandidate = (
  candidate: Candidate,
  interviewers: InterviewerAvailability[],
  candidates: Candidate[],
  avoidedInterviewers: string[] = [],
): InterviewMatch | null => {
  const candidateSlots = sortSlotValues(candidate.availability)
  const avoided = new Set(avoidedInterviewers)
  const loads = interviewerLoadMap(candidates, candidate.id)
  const fallbackCapacity = Math.max(candidates.length, 1)

  const options = candidateSlots.flatMap((slot, slotIndex) => {
    const availableInterviewers = interviewers
      .filter((interviewer) => !avoided.has(interviewer.name))
      .filter((interviewer) => interviewer.availability.includes(slot))
      .filter((interviewer) => (loads[interviewer.name] || 0) < parseCapacity(interviewer.maxInterviews, fallbackCapacity))
      .sort((a, b) => {
        const aLoad = loads[a.name] || 0
        const bLoad = loads[b.name] || 0
        if (aLoad !== bLoad) return aLoad - bLoad
        return a.name.localeCompare(b.name)
      })

    if (availableInterviewers.length === 0) {
      return []
    }

    const selectedInterviewers = availableInterviewers.slice(0, 2).map((interviewer) => interviewer.name)

    return [{
      assignedSlot: slot,
      interviewers: selectedInterviewers,
      overlapCount: availableInterviewers.length,
      slotIndex,
      loadScore: selectedInterviewers.reduce((total, interviewer) => total + (loads[interviewer] || 0), 0),
    }]
  })

  const best = options.sort((a, b) => {
    if (a.interviewers.length !== b.interviewers.length) return b.interviewers.length - a.interviewers.length
    if (a.loadScore !== b.loadScore) return a.loadScore - b.loadScore
    if (a.overlapCount !== b.overlapCount) return b.overlapCount - a.overlapCount
    return a.slotIndex - b.slotIndex
  })[0]

  if (!best) {
    return null
  }

  return {
    assignedSlot: best.assignedSlot,
    interviewers: uniqueStrings(best.interviewers).slice(0, 2),
    overlapCount: best.overlapCount,
  }
}

export const matchOpenInterviewSlate = (
  candidates: Candidate[],
  interviewers: InterviewerAvailability[],
  avoidance: InterviewerAvoidance = {},
) => {
  let matchedCount = 0
  const nextCandidates = candidates.map((candidate) => ({ ...candidate }))

  nextCandidates.forEach((candidate, index) => {
    if (candidate.assignedSlot && candidate.status !== 'Needs match') {
      return
    }

    if (!openMatchStatuses.has(candidate.status)) {
      return
    }

    const match = matchInterviewCandidate(candidate, interviewers, nextCandidates, avoidance[candidate.id] || [])
    if (!match) {
      return
    }

    matchedCount += 1
    nextCandidates[index] = {
      ...candidate,
      assignedSlot: match.assignedSlot,
      interviewers: match.interviewers,
      status: 'Matched',
    }
  })

  return {
    candidates: nextCandidates,
    matchedCount,
  }
}
