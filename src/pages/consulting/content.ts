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
    desc: 'Review how an organization’s websites and apps work for disabled people and recommend improvements.',
  },
  {
    id: 'documents',
    title: 'Documents & communications',
    desc: 'Help an organization share information in ways more people can use.',
  },
  {
    id: 'hiring',
    title: 'Hiring & workplace',
    desc: 'Look at how an organization recruits, hires, and supports disabled employees, and recommend changes.',
  },
  {
    id: 'events',
    title: 'Events & programs',
    desc: 'Help an organization make its events and programs open to everyone who wants to take part.',
  },
  {
    id: 'strategy',
    title: 'Strategy & business cases',
    desc: 'Research a market or opportunity and recommend a direction for an organization with a disability mission.',
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
    title: 'Campus events',
    when: 'Sep 2 & Sep 8',
    desc: 'We met students at Festifall on September 2 and BBA Meet the Clubs on September 8. Both events have ended; you can still apply online.',
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

export const CLIENT = {
  label: 'Fall 2026 client',
  name: 'Arc Thrift Stores',
  /* Who they are, and where the work ends up. Sam, Sept 9, 2026: the team
     presents to The Arc's national board at the end of the semester. */
  desc: 'One of Colorado’s largest employers of people with intellectual and developmental disabilities, Arc Thrift Stores funds advocacy in Colorado and New Mexico.',
  presentation: 'This fall, our team presents to The Arc’s national board.',
  audience: 'The largest community-based disability organization in the U.S.',
  url: 'https://arcthrift.com',
  /* The two logos read left to right: the national organization first, then
     the Colorado client whose stores fund its local chapters. */
  logos: [
    { src: '/client-the-arc.svg', alt: 'The Arc', role: 'The Arc of the United States' },
    { src: '/partners-arc-thrift.png', alt: 'arc Thrift Stores', role: 'Arc Thrift Stores of Colorado, our client' },
  ],
  /* Rechecked Sept 9: thearc.org/about-us (549 chapters), KGNU's April 3,
     2026 Arc interview (600 employees), lloydlewis.net ($120M+ enterprise). */
  stats: [
    { value: '549', label: 'The Arc chapters nationwide' },
    { value: '600', label: 'Arc Thrift employees with IDD' },
    { value: '$120M+', label: 'Arc Thrift social enterprise' },
  ],
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
