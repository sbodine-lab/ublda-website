import { APPLY_DEADLINE_AT_MS, APPLY_OPENS_AT_MS, applyWindow } from './applyForm'
import { CONSULTING_FORM_URL } from './forms'
import { useClock } from './useClock'

/** Public calls to action use the advertised deadline, not the submission grace period. */
export function useConsultingApplication() {
  const state = applyWindow(useClock(APPLY_OPENS_AT_MS, APPLY_DEADLINE_AT_MS), APPLY_DEADLINE_AT_MS)
  return {
    state,
    href: state === 'open' ? CONSULTING_FORM_URL : '/consulting/apply',
    label: state === 'open' ? 'Apply' : 'Recruiting',
  }
}
