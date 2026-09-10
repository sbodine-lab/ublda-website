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
          <h1>Leave the mailing list</h1>
          <p className="unsubscribe-page__intro">
            Send an email from the address you’d like removed.
          </p>
          <div className="unsubscribe-page__actions">
            <a href={mailto} className="btn btn--primary">Email a removal request</a>
            <a href={gmail} className="btn btn--ghost" target="_blank" rel="noopener noreferrer">
              Open in Gmail<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>

        </div>
      </div>
    </main>
  )
}
