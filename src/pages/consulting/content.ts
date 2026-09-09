/* Copy for the UBLDA Consulting page. Facts come from the club Brain:
   recruiting dates (decision 2026-09-01), the Arc Thrift engagement
   (Lloyd Lewis call, 2026-07-28), the operating model (Outreach Meeting
   Guide), and the project-manager assignment (2026-08-18). */

import { APPLY_WINDOW_SHORT, APPLY_DEADLINE_LABEL } from '../../lib/applyForm'

export const HERO_DESCRIPTION =
  'Work with fellow Michigan students on pro bono client projects in business strategy and accessibility.'

export const STATEMENT_1 =
  'UBLDA Consulting is the pro bono consulting program of Undergraduate Business Leaders for Diverse Abilities at Michigan Ross. Our first client is Arc Thrift Stores of Colorado.'

export const STATEMENT_2 =
  'As an analyst, you work in a team of four to six with two project managers. You’ll research the client’s business question and develop recommendations for a final presentation.'

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
    when: APPLY_WINDOW_SHORT,
    desc: `Apply by ${APPLY_DEADLINE_LABEL}. Three short answers and an optional resume. No consulting experience needed.`,
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
    desc: 'Receive your application decision by September 29.',
    tone: 'cream',
  },
  {
    num: '05',
    title: 'Kickoff',
    when: 'Week of Oct 5',
    desc: 'Begin project work with four to six analysts and two project managers.',
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

export type ClientFactTone = 'gold' | 'teal' | 'cream' | 'navy'

export interface ClientFact {
  /* Small caps line above the figure: which organization the fact is about. */
  kicker: string
  value: string
  label: string
  tone: ClientFactTone
  /* A sentence-length fact gets a wider card. */
  wide?: boolean
}

export const CLIENT = {
  label: 'Fall 2026 client',
  name: 'Arc Thrift Stores of Colorado',
  project: 'Arc University business case',
  desc: 'A business case to scale Arc University, Arc Thrift’s post-secondary program for adults with intellectual and developmental disabilities, with a path into The Arc’s national network.',
  url: 'https://arcthrift.com',
  /* The two logos read left to right: the national organization first, then
     the Colorado client whose stores fund its local chapters. */
  logos: [
    { src: '/client-the-arc.svg', alt: 'The Arc', role: 'The Arc of the United States', note: 'National network' },
    { src: '/partners-arc-thrift.png', alt: 'arc Thrift Stores', role: 'Arc Thrift Stores of Colorado', note: 'Our client' },
  ],
  /* Sources, checked Sept 8, 2026: thearc.org/about-us (chapters, founding,
     "largest"); thearc.org 2018 data brief (7.3M people with IDD);
     KJCT Feb 6, 2026 CEO interview (600 employees with IDD); lloydlewis.net
     ($32M to $120M+); July 28, 2026 sponsor call (Foundation board offer). */
  facts: [
    { kicker: 'The Arc', value: '549', label: 'state and local chapters in The Arc’s national network, founded in 1950.', tone: 'gold' },
    { kicker: 'The Arc', value: '7M+', label: 'people with intellectual and developmental disabilities in the U.S., served by the largest community-based disability organization in the country.', tone: 'teal' },
    { kicker: 'Arc Thrift', value: '600', label: 'employees with intellectual and developmental disabilities, one of Colorado’s largest employers of people with IDD.', tone: 'cream' },
    { kicker: 'Arc Thrift', value: '$120M+', label: 'social enterprise, grown from a $32M thrift chain, funding Colorado’s 15 Arc chapters since 1968.', tone: 'navy' },
    { kicker: 'Where it goes', value: 'The Arc U.S.', label: 'Arc Thrift’s CEO sits on The Arc of the United States Foundation board and has offered to bring the finished case to The Arc’s national leadership.', tone: 'teal', wide: true },
    { kicker: 'The work', value: '5-year', label: 'business case: market sizing, pricing, go-to-market, launch investment and KPIs, presented at the end of the semester.', tone: 'gold' },
  ] as ClientFact[],
}

export const PARTNER_STATEMENT =
  'Our connections at Michigan Ross bring students together with people working in disability-focused businesses.'

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
  { label: 'Contact', to: '/consulting/contact' },
]

export const ROSS_ADDRESS = ['Stephen M. Ross School of Business', '701 Tappan Avenue', 'Ann Arbor, MI 48109']
