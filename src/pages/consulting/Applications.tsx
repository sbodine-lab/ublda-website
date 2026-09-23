import { Button, Studio } from './Studio'
import './applications.css'

export default function ConsultingApplications() {
  return (
    <Studio title="Applications" dark>
      <section className="st-wrap st-applications" aria-labelledby="applications-title">
        <p className="st-eyebrow" data-enter>Analyst recruiting</p>
        <h1 id="applications-title" data-enter>
          Fall 2026 applications<br />{' '}are closed.
        </h1>
        <p className="st-applications-thanks" data-enter>
          Thank you to everyone who applied to UBLDA Consulting.
        </p>
        <div className="st-applications-next" data-enter>
          <div>
            <p className="st-eyebrow">Next recruiting cycle</p>
            <h2>Winter 2027</h2>
          </div>
          <div className="st-applications-details">
            <p>Keep an eye out for Winter 2027 application dates and program information.</p>
            <Button to="/consulting/practice">Explore the program</Button>
          </div>
        </div>
      </section>
    </Studio>
  )
}
