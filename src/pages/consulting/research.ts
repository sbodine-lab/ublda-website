/** Primary sources checked September 16, 2026. Research is context, never a UBLDA outcome. */
export const RESEARCH = [
  {
    id: "disability-is-not-a-niche",
    category: "Perspective",
    source: "World Health Organization",
    date: "March 2023",
    value: "1.3B",
    title: "Disability and market strategy.",
    summary:
      "An estimated 1.3 billion people worldwide experience significant disability which represents about one in six people.",
    url: "https://www.who.int/news-room/fact-sheets/detail/disability-and-health",
    takeaway:
      "Accessibility shapes who can use a company’s products and services and whose needs are reflected in its decisions. Including disabled people in early research helps businesses understand those experiences before choosing a direction.",
    context:
      "WHO’s estimate covers significant disability worldwide and encompasses a wide range of needs and experiences that business research should account for.",
  },
  {
    id: "the-business-case",
    category: "Research",
    source: "Accenture · Disability:IN · AAPD",
    date: "November 2023",
    value: "1.6×",
    title: "Disability inclusion and business performance.",
    summary:
      "Disability-inclusion leaders in Accenture’s study generated 1.6 times the revenue of other participating companies.",
    url: "https://newsroom.accenture.com/news/2023/companies-that-lead-in-disability-inclusion-outperform-peers-financially-reveals-new-research-from-accenture",
    takeaway:
      "This research helps explain why disability inclusion belongs in conversations about business strategy. Evidence from an individual organization is still needed to understand its priorities and evaluate possible changes.",
    context:
      "The 2023 study analyzed about 346 unique Disability Equality Index respondents from 2015–2022. The association does not establish causation or predict the return from a consulting project.",
  },
  {
    id: "employment-and-access",
    category: "Data",
    source: "U.S. Bureau of Labor Statistics",
    date: "March 2026 · 2025 data",
    value: "38.1%",
    title: "A broader view of workforce opportunity.",
    summary:
      "BLS reports that 38.1% of U.S. people with a disability ages 16–64 were employed in 2025.",
    url: "https://www.bls.gov/news.release/disabl.nr0.htm",
    takeaway:
      "Recruiting and workplace systems shape access to employment throughout the path from application to onboarding. Examining that experience can help an organization identify barriers within its own processes.",
    context:
      "This figure measures the share of the population that is employed. It is not an unemployment rate. BLS used 11 months of data because October 2025 was not collected. The annual estimate is not strictly comparable with other years.",
  },
];

export const AREAS = [
  {
    id: "strategy",
    title: "Strategy & growth",
    desc: "Our teams research markets and evaluate growth opportunities for organizations with a disability mission.",
    detail:
      "We examine the client’s market and compare strategic options to develop a business case grounded in research. The work connects an organization’s goals with the opportunities and constraints that shape its decisions.",
    examples: [
      "Market and competitor research",
      "Program and growth opportunities",
      "Business cases and decision criteria",
    ],
  },
  {
    id: "accessibility",
    title: "Accessible experiences",
    desc: "Our teams study how people use products and services to identify barriers and recommend more accessible experiences.",
    detail:
      "We explore how disabled people find information and use a client’s services to understand where access breaks down. Our recommendations focus on practical improvements that respond to those experiences.",
    examples: [
      "Websites and app experiences",
      "Documents and communications",
      "Events and program participation",
    ],
  },
  {
    id: "workplace",
    title: "Inclusive workplaces",
    desc: "Our teams examine hiring and workplace practices to understand how organizations can better support disabled employees.",
    detail:
      "We study the path from recruitment to everyday work and research how workplace processes could better serve disabled employees. The team uses those findings to recommend improvements in how an organization supports its people.",
    examples: [
      "Recruiting and hiring experiences",
      "Onboarding and employee communication",
      "Workplace practices and support",
    ],
  },
] as const;
