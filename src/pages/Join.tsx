import { useEffect } from 'react'
import { MEMBERSHIP_FORM_URL } from '../lib/forms'

export default function Join() {
  useEffect(() => {
    window.location.replace(MEMBERSHIP_FORM_URL)
  }, [])

  return (
    <main id="main-content" className="section container">
      <h1>Fall 2026 membership sign-up</h1>
      <a href={MEMBERSHIP_FORM_URL} className="btn btn--primary btn--lg">Join UBLDA</a>
    </main>
  )
}
