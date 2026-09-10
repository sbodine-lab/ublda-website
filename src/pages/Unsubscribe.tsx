import { useEffect } from 'react'
import { REMOVAL_FORM_URL } from '../lib/forms'
import './Unsubscribe.css'

export default function Unsubscribe() {
  useEffect(() => {
    window.location.replace(REMOVAL_FORM_URL)
  }, [])

  return (
    <main id="main-content" className="unsubscribe-page">
      <div className="container">
        <div className="unsubscribe-page__content">
          <h1>Leave the mailing list</h1>
          <div className="unsubscribe-page__actions">
            <a href={REMOVAL_FORM_URL} className="btn btn--primary">Open form</a>
          </div>

        </div>
      </div>
    </main>
  )
}
