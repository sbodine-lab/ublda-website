/* Copy for the UBLDA Consulting page. Facts come from the club Brain:
   recruiting dates (decision 2026-09-01), the Arc Thrift engagement
   (Lloyd Lewis call, 2026-07-28), the operating model (Outreach Meeting
   Guide), and the project-manager assignment (2026-08-18). */

export const HERO_LEAD = 'Student consulting at Michigan'

export const HERO_DESCRIPTION =
  'Join a student team working with real clients on disability inclusion. Put your research and ideas to work on a semester-long project, with guidance from project managers and advisors.'

export const STATEMENT_1 =
  'UBLDA Consulting brings Michigan students together to help organizations make business more inclusive of disabled people. We take on real client projects, pro bono.'

export const STATEMENT_2 =
  'As an analyst, you work in a team of four to six with two project managers. Weekly deliverables and advisor feedback build toward a final client presentation.'

export interface Service {
  id: string
  title: string
  desc: string
}

export const SERVICES: Service[] = [
  {
    id: 'digital',
    title: 'Websites & apps',
    desc: 'Investigate where a website or app creates barriers for disabled users and recommend what the client should address first.',
  },
  {
    id: 'documents',
    title: 'Documents & communications',
    desc: 'Examine how people access PDFs, presentations, and newsletters, then recommend more accessible ways to share information.',
  },
  {
    id: 'hiring',
    title: 'Hiring & workplace',
    desc: 'Study hiring and onboarding to identify barriers for disabled candidates and employees.',
  },
  {
    id: 'events',
    title: 'Events & programs',
    desc: 'Help organizations plan for access throughout an event, including invitations, venues, accommodations, and materials.',
  },
  {
    id: 'strategy',
    title: 'Strategy & business cases',
    desc: 'Develop market research and financial recommendations for organizations with a disability mission. Our first project is the Arc University business case.',
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
    when: 'Sep 2 to Sep 20',
    desc: 'Opens Sep 2 at noon ET, closes Sep 20 at 11:30 PM ET. Three short answers and an optional resume link. No consulting experience needed.',
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
  'Our home is Michigan Ross. Our work connects students with organizations advancing disability inclusion beyond campus.'

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
