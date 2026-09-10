import { Link } from 'react-router-dom'
import './Unsubscribe.css'

const recipient = 'sbodine@umich.edu'
const subject = 'UBLDA unsubscribe request'
const body = 'Please remove me from the UBLDA mailing list. Thank you.'
const mailto = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

export default function Unsubscribe() {
  return (
    <main id="main-content" className="unsubscribe-page">
      <div className="container">
        <div className="unsubscribe-page__content">
          <p className="section__label">Email preferences</p>
          <h1>Leave the mailing list</h1>
          <p className="unsubscribe-page__intro">
            To stop receiving UBLDA emails, send a removal request to Sam Bodine.
            No explanation needed.
          </p>
          <div className="unsubscribe-page__actions">
            <a href={mailto} className="btn btn--primary">Email a removal request</a>
            <a href={gmail} className="btn btn--ghost" target="_blank" rel="noopener noreferrer">
              Open in Gmail<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
          <p className="unsubscribe-page__note">
            These links open a prepared email. Send it from the address that receives
            UBLDA updates, or include that address in your message. Sam will remove
            it manually; opening this page does not unsubscribe you.
          </p>
          <div className="unsubscribe-page__fallback">
            <p>You can also write directly to <a href={mailto}>{recipient}</a> with
              the subject <strong>UBLDA unsubscribe request</strong>.</p>
          </div>
          <Link to="/" className="unsubscribe-page__back">Back to UBLDA</Link>
        </div>
      </div>
    </main>
  )
}
