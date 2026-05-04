import {
  INTERVIEW_DAY_PARTS,
  INTERVIEW_SLOT_GROUPS,
  INTERVIEW_SLOTS,
  sortSlotValues,
} from '../lib/interviews'

type AvailabilityPickerProps = {
  selectedValues: string[]
  onChange: (values: string[]) => void
  legend?: string
  helper?: string
}

const valuesForAll = INTERVIEW_SLOTS.map((slot) => slot.value)

export default function AvailabilityPicker({
  selectedValues,
  onChange,
  legend = 'Interview availability',
  helper,
}: AvailabilityPickerProps) {
  const selected = new Set(selectedValues)

  const replaceValues = (nextValues: Iterable<string>) => {
    onChange(sortSlotValues(nextValues))
  }

  const toggleValues = (values: string[]) => {
    const next = new Set(selectedValues)
    const allSelected = values.every((value) => next.has(value))

    values.forEach((value) => {
      if (allSelected) {
        next.delete(value)
      } else {
        next.add(value)
      }
    })

    replaceValues(next)
  }

  const toggleSlot = (value: string) => {
    const next = new Set(selectedValues)

    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }

    replaceValues(next)
  }

  const valuesForPart = (partKey: (typeof INTERVIEW_DAY_PARTS)[number]['key']) =>
    INTERVIEW_SLOT_GROUPS.flatMap((group) => group.parts.find((part) => part.key === partKey)?.slots.map((slot) => slot.value) || [])

  return (
    <fieldset className="apply-form__group availability-picker">
      <legend>{legend}</legend>
      {helper && <p className="apply-form__helper">{helper}</p>}

      <div className="availability-summary">
        <strong>{selectedValues.length}</strong>
        <span>buffered slot{selectedValues.length === 1 ? '' : 's'} selected</span>
      </div>

      <div className="availability-quick-actions" aria-label="Availability shortcuts">
        <button type="button" onClick={() => toggleValues(valuesForAll)}>
          {selectedValues.length === valuesForAll.length ? 'Clear all' : 'Select all'}
        </button>
        {INTERVIEW_DAY_PARTS.map((part) => {
          const values = valuesForPart(part.key)
          const selectedCount = values.filter((value) => selected.has(value)).length

          return (
            <button type="button" key={part.key} onClick={() => toggleValues(values)}>
              {selectedCount === values.length ? `Clear ${part.label.toLowerCase()}s` : `All ${part.label.toLowerCase()}s`}
            </button>
          )
        })}
      </div>

      <div className="availability-days">
        {INTERVIEW_SLOT_GROUPS.map((group, index) => {
          const values = group.slots.map((slot) => slot.value)
          const selectedCount = values.filter((value) => selected.has(value)).length

          return (
            <section className="availability-day" key={group.date}>
              <div className="availability-day__header">
                <div>
                  <h3>{group.label}</h3>
                  <p>{selectedCount} of {values.length} buffered slots selected</p>
                </div>
                <button type="button" onClick={() => toggleValues(values)}>
                  {selectedCount === values.length ? 'Clear day' : 'Select day'}
                </button>
              </div>

              <details className="availability-day__details" open={index === 0}>
                <summary>Choose exact times</summary>

                <div className="availability-parts">
                  {group.parts.map((part) => {
                    const partValues = part.slots.map((slot) => slot.value)
                    const partSelectedCount = partValues.filter((value) => selected.has(value)).length

                    return (
                      <div className="availability-part" key={part.key}>
                        <div className="availability-part__header">
                          <div>
                            <strong>{part.label}</strong>
                            <span>{part.rangeLabel} · {partSelectedCount}/{partValues.length}</span>
                          </div>
                          <button type="button" onClick={() => toggleValues(partValues)}>
                            {partSelectedCount === partValues.length ? 'Clear' : 'Select'}
                          </button>
                        </div>

                        <div className="availability-grid">
                          {part.slots.map((slot) => (
                            <label className="apply-form__checkbox availability-slot" key={slot.value}>
                              <input
                                type="checkbox"
                                checked={selected.has(slot.value)}
                                onChange={() => toggleSlot(slot.value)}
                              />
                              <span>
                                <strong>{slot.timeLabel.replace(' ET', '')}</strong>
                                <small>{slot.bufferLabel}</small>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </details>
            </section>
          )
        })}
      </div>
    </fieldset>
  )
}
