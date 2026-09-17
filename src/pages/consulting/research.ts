/** Primary sources checked September 16, 2026. Research is context, never a UBLDA outcome. */
export const RESEARCH = [
  {
    id: "disability-is-not-a-niche",
    category: "Perspective",
    source: "World Health Organization",
    date: "March 2023",
    value: "1.3B",
    title: "Disability belongs in your market strategy.",
    summary:
      "An estimated 1.3 billion people worldwide experience significant disability. That is about one in six people.",
    url: "https://www.who.int/news-room/fact-sheets/detail/disability-and-health",
    takeaway:
      "Accessibility shapes who can use your products and services. Include disabled people in early research so their needs inform business decisions and measures of success.",
    context:
      "WHO’s estimate covers significant disability worldwide. Needs and experiences vary. Research should account for that variation.",
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
      "Disability inclusion deserves a place in business strategy. Use this research to frame the opportunity. Use evidence from your own organization to decide where to act.",
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
      "Recruiting and workplace systems shape access to employment. Examine the path from application to onboarding to identify barriers your organization can address.",
    context:
      "This figure measures the share of the population that is employed. It is not an unemployment rate. BLS used 11 months of data because October 2025 was not collected. The annual estimate is not strictly comparable with other years.",
  },
];

export const AREAS = [
  {
    id: "strategy",
    title: "Strategy & growth",
    desc: "Research markets and compare growth options for organizations with a disability mission.",
    detail:
      "Research the client’s market and compare strategic options. Practice building a business case that connects evidence to a clear recommendation.",
    examples: [
      "Market and competitor research",
      "Program and growth opportunities",
      "Business cases and decision criteria",
    ],
  },
  {
    id: "accessibility",
    title: "Accessible experiences",
    desc: "Study how people use products and services. Recommend ways to remove access barriers.",
    detail:
      "Examine how disabled people find information and use a client’s services. Learn to identify barriers and evaluate practical improvements.",
    examples: [
      "Websites and app experiences",
      "Documents and communications",
      "Events and program participation",
    ],
  },
  {
    id: "workplace",
    title: "Inclusive workplaces",
    desc: "Examine hiring and workplace practices through the lens of disability inclusion.",
    detail:
      "Study the path from recruitment to everyday work. Research how workplace processes and support could better serve disabled employees, then develop recommendations with your team.",
    examples: [
      "Recruiting and hiring experiences",
      "Onboarding and employee communication",
      "Workplace practices and support",
    ],
  },
] as const;
