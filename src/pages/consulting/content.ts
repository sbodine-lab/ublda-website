/* Copy for the UBLDA Consulting page. Facts come from the club Brain:
   recruiting dates (decision 2026-09-01), the Arc Thrift engagement
   (Lloyd Lewis call, 2026-07-28), the operating model (Outreach Meeting
   Guide), and the project-manager assignment (2026-08-18). */

export const HERO_LEAD = 'Does your business work for'

export const HERO_PHRASES = [
  'a screen reader user?',
  'a Deaf applicant?',
  'a blind shopper?',
  'an autistic new hire?',
  'a wheelchair user?',
  'someone with dyslexia?',
  'a colorblind customer?',
  'someone who cannot use a mouse?',
  'a candidate with ADHD?',
  'one in four adults?',
]

export const STATEMENT_1 =
  'UBLDA Consulting is a pro bono accessibility practice run by students at Michigan Ross, inside the Undergraduate Business Leaders for Diverse Abilities.'

export const STATEMENT_2 =
  'A team of four to six analysts takes on one scoped project a semester, with weekly deliverables and advisor review before anything reaches you.'

export interface Service {
  id: string
  title: string
  desc: string
}

export const SERVICES: Service[] = [
  {
    id: 'digital',
    title: 'Websites & apps',
    desc: 'Where your site or app stops working for disabled visitors, and what to fix first.',
  },
  {
    id: 'documents',
    title: 'Documents & communications',
    desc: 'PDFs, decks, and newsletters that work the same for a blind reader as for a sighted one.',
  },
  {
    id: 'hiring',
    title: 'Hiring & workplace',
    desc: 'Job posts, interviews, and onboarding where disabled candidates get stuck in ways most teams never see.',
  },
  {
    id: 'events',
    title: 'Events & programs',
    desc: 'Venues, accommodations, and materials, planned from the invitation onward.',
  },
  {
    id: 'strategy',
    title: 'Strategy & business cases',
    desc: 'For organizations with a disability mission: market sizing, pricing, go-to-market, and the five-year model.',
  },
]

export interface Step {
  num: string
  title: string
  when: string
  desc: string
  tone: 'navy' | 'teal' | 'gold' | 'cream'
}

/* Dates here must match src/lib/applyForm.ts, which is the source of truth for
   the application window and drives the labels on Home and /apply. */
export const STEPS: Step[] = [
  {
    num: '01',
    title: 'Meet us',
    when: 'Sep 2 & Sep 8',
    desc: 'Festifall Central, Sep 2, 3 to 5 PM, Diag Table C43. BBA Meet the Clubs, Sep 8, 5:30 to 7:30 PM, Ross Winter Garden.',
    tone: 'teal',
  },
  {
    num: '02',
    title: 'Apply',
    when: 'Sep 2 to Sep 22',
    desc: 'Opens Sep 2 at noon ET, closes Sep 22 at 11:30 PM ET. Three short answers and an optional resume link. No consulting experience needed.',
    tone: 'navy',
  },
  {
    num: '03',
    title: 'Interview',
    when: 'Sep 25 to Sep 27',
    desc: 'Two 30-minute conversations at Ross, one behavioral and one technical.',
    tone: 'gold',
  },
  {
    num: '04',
    title: 'Offers',
    when: 'By Sep 29',
    desc: 'Decisions by September 29. All majors and years welcome.',
    tone: 'cream',
  },
  {
    num: '05',
    title: 'Kickoff',
    when: 'Week of Oct 5',
    desc: 'Teams of four to six analysts with two co-project managers.',
    tone: 'teal',
  },
  {
    num: '06',
    title: 'Deliver',
    when: 'Through the semester',
    desc: 'Weekly deliverables, a midpoint review, and a final presentation.',
    tone: 'navy',
  },
]

export const CLIENT = {
  label: 'Fall 2026 client',
  name: 'Arc Thrift Stores of Colorado',
  project: 'Arc University business case',
  desc: 'A business case to scale Arc University, Arc Thrift’s post-secondary program for adults with intellectual and developmental disabilities.',
  url: 'https://arcthrift.com',
  chips: ['Fall 2026 client', 'Arc University', 'Business case', 'Pricing & market sizing', 'Go-to-market', 'Five-year model'],
}

export const PARTNER_STATEMENT =
  'We work with organizations that already put disabled people at the center, and with companies that want to get there.'

export const PARTNERS = [
  { src: '/partners-ross.png', alt: 'Michigan Ross School of Business' },
  { src: '/partners-occb.png', alt: 'Office of Community, Culture, and Belonging' },
  { src: '/partners-blda.webp', alt: 'Business Leaders for Diverse Abilities' },
  { src: '/partners-nestidd.png', alt: 'Nestidd' },
]

export const LEADERS = [
  { name: 'Alex Forstner', role: 'VP of Education, project manager', email: 'alexfors@umich.edu', linkedin: 'https://www.linkedin.com/in/alex-forstner/' },
  { name: 'Solomon DeYoung', role: 'VP Outreach and Partnerships, project manager', email: 'sdeyoun@umich.edu', linkedin: 'https://www.linkedin.com/in/solomon-deyoung/' },
]

export const CONTACT_MAILTO =
  'mailto:alexfors@umich.edu,sdeyoun@umich.edu?subject=UBLDA%20Consulting%20inquiry'

export const SOCIAL = [
  { label: 'Instagram', href: 'https://www.instagram.com/michiganublda/' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/ublda/' },
]

export const PAGE_LINKS = [
  { label: 'Practice', to: '/consulting/practice' },
  { label: 'Work', to: '/consulting/work' },
  { label: 'Services', to: '/consulting/services' },
  { label: 'Partners', to: '/consulting/partners' },
  { label: 'Connect', to: '/consulting/contact' },
]

export const ROSS_ADDRESS = ['Stephen M. Ross School of Business', '701 Tappan Avenue', 'Ann Arbor, MI 48109']
