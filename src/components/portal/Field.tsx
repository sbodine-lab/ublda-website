import { useId } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import '../../styles/portal.css'

/**
 * One shape for every input in the portal (spec §7.2).
 *
 * Guarantees this component makes, so no caller has to remember them:
 *  · a visible `<label htmlFor>` — a placeholder is never the label;
 *  · required stated in the label text, "(required)", never a bare asterisk;
 *  · `aria-describedby` listing hint **then** error, in that order;
 *  · `aria-invalid` only when the field is actually in error.
 *
 * What callers still owe: `autocomplete` on name / email / tel fields, and not
 * validating on blur of a field the member never touched.
 */

type FieldIds = {
  id: string
  hintId: string
  errorId: string
  describedBy: string | undefined
}

function useFieldIds(explicitId: string | undefined, hint: ReactNode, error: string | undefined): FieldIds {
  const generated = useId()
  const id = explicitId ?? `${generated}-control`
  const hintId = `${generated}-hint`
  const errorId = `${generated}-error`
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
  return { id, hintId, errorId, describedBy }
}

type SharedFieldProps = {
  label: string
  hint?: ReactNode
  error?: string
  /** Wrapper class. Use `inputClassName` to reach the control itself. */
  className?: string
}

function FieldLabel({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <label className="p-field__label" htmlFor={id}>
      {label}
      {required ? <span className="p-field__req"> (required)</span> : null}
    </label>
  )
}

function FieldMessages({ hint, hintId, error, errorId }: {
  hint?: ReactNode
  hintId: string
  error?: string
  errorId: string
}) {
  return (
    <>
      {hint ? <p id={hintId} className="p-field__hint">{hint}</p> : null}
      {error ? (
        <p id={errorId} className="p-field__error">
          <span aria-hidden="true">▲</span>{error}
        </p>
      ) : null}
    </>
  )
}

/* ── Text input ─────────────────────────────────────────────────────── */

export type FieldProps = SharedFieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
    inputClassName?: string
  }

export function Field({ label, hint, error, className, inputClassName, id, required, ...rest }: FieldProps) {
  const ids = useFieldIds(id, hint, error)
  return (
    <div className={className ? `p-field ${className}` : 'p-field'} data-invalid={error ? 'true' : undefined}>
      <FieldLabel id={ids.id} label={label} required={required} />
      {hint ? <p id={ids.hintId} className="p-field__hint">{hint}</p> : null}
      <input
        {...rest}
        id={ids.id}
        className={inputClassName ? `p-input ${inputClassName}` : 'p-input'}
        required={required}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p id={ids.errorId} className="p-field__error">
          <span aria-hidden="true">▲</span>{error}
        </p>
      ) : null}
    </div>
  )
}

/* ── Textarea ───────────────────────────────────────────────────────── */

export type TextareaFieldProps = SharedFieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
    inputClassName?: string
    /**
     * Renders "123 / 600" under the field. Deliberately NOT in
     * `aria-describedby` — a count that re-announces on every keystroke is
     * unusable. State the limit in `hint` instead; the count is a live visual
     * aid that stays readable in browse mode.
     */
    showCount?: boolean
  }

export function TextareaField({
  label, hint, error, className, inputClassName, id, required, showCount, maxLength, value, ...rest
}: TextareaFieldProps) {
  const ids = useFieldIds(id, hint, error)
  const length = typeof value === 'string' ? value.length : Array.isArray(value) ? value.join('').length : 0
  const over = typeof maxLength === 'number' && length > maxLength
  return (
    <div className={className ? `p-field ${className}` : 'p-field'} data-invalid={error ? 'true' : undefined}>
      <FieldLabel id={ids.id} label={label} required={required} />
      {hint ? <p id={ids.hintId} className="p-field__hint">{hint}</p> : null}
      <textarea
        {...rest}
        value={value}
        maxLength={maxLength}
        id={ids.id}
        className={inputClassName ? `p-textarea ${inputClassName}` : 'p-textarea'}
        required={required}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
      />
      {showCount && typeof maxLength === 'number' ? (
        <p className="p-field__count p-num" data-over={over ? 'true' : undefined}>{`${length} / ${maxLength}`}</p>
      ) : null}
      {error ? (
        <p id={ids.errorId} className="p-field__error">
          <span aria-hidden="true">▲</span>{error}
        </p>
      ) : null}
    </div>
  )
}

/* ── Select ─────────────────────────────────────────────────────────── */

export type SelectOption = { value: string; label: string; disabled?: boolean }

export type SelectFieldProps = SharedFieldProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
    inputClassName?: string
    /** Convenience. Ignored when `children` is supplied. */
    options?: SelectOption[]
  }

export function SelectField({
  label, hint, error, className, inputClassName, id, required, options, children, ...rest
}: SelectFieldProps) {
  const ids = useFieldIds(id, hint, error)
  return (
    <div className={className ? `p-field ${className}` : 'p-field'} data-invalid={error ? 'true' : undefined}>
      <FieldLabel id={ids.id} label={label} required={required} />
      {hint ? <p id={ids.hintId} className="p-field__hint">{hint}</p> : null}
      <select
        {...rest}
        id={ids.id}
        className={inputClassName ? `p-select ${inputClassName}` : 'p-select'}
        required={required}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
      >
        {children ?? options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
        ))}
      </select>
      {error ? (
        <p id={ids.errorId} className="p-field__error">
          <span aria-hidden="true">▲</span>{error}
        </p>
      ) : null}
    </div>
  )
}

/* ── Custom control ─────────────────────────────────────────────────── */

export type FieldShellRenderProps = {
  id: string
  describedBy: string | undefined
  invalid: true | undefined
}

export type FieldShellProps = SharedFieldProps & {
  required?: boolean
  id?: string
  /** Receives the wired ids. Put them on whatever control you are rendering. */
  children: (props: FieldShellRenderProps) => ReactNode
}

/** The label/hint/error frame around a control this file does not own. */
export function FieldShell({ label, hint, error, className, required, id, children }: FieldShellProps) {
  const ids = useFieldIds(id, hint, error)
  return (
    <div className={className ? `p-field ${className}` : 'p-field'} data-invalid={error ? 'true' : undefined}>
      <FieldLabel id={ids.id} label={label} required={required} />
      {hint ? <p id={ids.hintId} className="p-field__hint">{hint}</p> : null}
      {children({ id: ids.id, describedBy: ids.describedBy, invalid: error ? true : undefined })}
      {error ? (
        <p id={ids.errorId} className="p-field__error">
          <span aria-hidden="true">▲</span>{error}
        </p>
      ) : null}
    </div>
  )
}

/* ── Grouped controls ───────────────────────────────────────────────── */

export type FieldGroupProps = {
  /** Rendered as the `<legend>`. Every checkbox and radio group needs one. */
  legend: string
  hint?: ReactNode
  error?: string
  required?: boolean
  /** Lay the choices out in a row rather than a column. */
  row?: boolean
  className?: string
  children: ReactNode
}

/**
 * A real `<fieldset>` + `<legend>` around a checkbox or radio group. Radio
 * groups and multi-checkbox questions must use this — a group with no legend
 * has no accessible name.
 */
export function FieldGroup({ legend, hint, error, required, row, className, children }: FieldGroupProps) {
  const ids = useFieldIds(undefined, hint, error)
  return (
    <fieldset
      className={className ? `p-fieldset ${className}` : 'p-fieldset'}
      aria-describedby={ids.describedBy}
      aria-invalid={error ? true : undefined}
    >
      <legend className="p-legend">
        {legend}
        {required ? <span className="p-field__req"> (required)</span> : null}
      </legend>
      <FieldMessages hint={hint} hintId={ids.hintId} error={error} errorId={ids.errorId} />
      <div className={row ? 'p-choicegroup p-choicegroup--row' : 'p-choicegroup'}>{children}</div>
    </fieldset>
  )
}

export type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & {
  label: string
  /** Secondary line under the label. Part of the control's accessible name. */
  note?: string
  type: 'checkbox' | 'radio'
  className?: string
}

/** A single checkbox or radio with its label. Always inside a `FieldGroup`. */
export function Choice({ label, note, type, className, id, ...rest }: ChoiceProps) {
  const generated = useId()
  const controlId = id ?? `${generated}-choice`
  return (
    <label className={className ? `p-choice ${className}` : 'p-choice'} htmlFor={controlId}>
      <input {...rest} type={type} id={controlId} />
      <span className="p-choice__text">
        <span>{label}</span>
        {note ? <span className="p-choice__note">{note}</span> : null}
      </span>
    </label>
  )
}

export default Field
