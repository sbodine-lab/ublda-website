import { LEADERS } from './content'
import { buildReveals, startMotion, type MotionStarter } from './engine'
import { DotButton } from './parts'
import { ConsultingShell } from './Shell'

const startLeadership: MotionStarter = (root, onMode, reduce) =>
  startMotion(root, onMode, (page) => { buildReveals(page) }, { reduce })

export default function ConsultingLeadership() {
  return (
    <ConsultingShell title="Leadership · UBLDA Consulting" motion={startLeadership}>
      <section className="pcl-leadership" aria-labelledby="pcl-title">
        <header className="pcl-leadership__intro">
          <p className="pcl-leadership__eyebrow">Fall 2026</p>
          <h1 id="pcl-title">Consulting leadership</h1>
        </header>
        <div className="pcl-leadership__people">
          {LEADERS.map((leader) => (
            <article className="pcl-leadership__person" key={leader.email} data-reveal>
              <span className="pcl-leadership__initials" aria-hidden="true">
                {leader.name.split(' ').map((name) => name[0]).join('')}
              </span>
              <p className="pcl-leadership__eyebrow">Project Manager</p>
              <h2>{leader.name}</h2>
              <p className="pcl-leadership__role">{leader.role.split(',')[0]}</p>
              <DotButton href={`mailto:${leader.email}`}>{leader.email}</DotButton>
            </article>
          ))}
        </div>
        <div className="pcl-leadership__board">
          <p>Meet the rest of UBLDA’s leadership.</p>
          <DotButton to="/team">View the full E-board</DotButton>
        </div>
      </section>
    </ConsultingShell>
  )
}
