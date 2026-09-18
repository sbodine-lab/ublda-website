/** Primary sources checked September 17, 2026. Research is context, never a UBLDA outcome. */
export const RESEARCH = [
  {
    id: "disability-is-not-a-niche",
    category: "Perspective",
    source: "World Health Organization",
    date: "March 2023",
    value: "1.3B",
    metricLabel: "people worldwide experience significant disability",
    cardNote: "WHO’s estimate represents about one in six people worldwide.",
    title: "Disability and market strategy.",
    summary:
      "An estimated 1.3 billion people worldwide experience significant disability, which represents about one in six people.",
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
    metricLabel: "the revenue for disability-inclusion leaders compared with other companies in the study",
    cardNote: "An association in the study, not evidence that inclusion alone caused higher revenue.",
    title: "Disability inclusion and business performance.",
    summary:
      "Disability-inclusion leaders in Accenture’s study generated 1.6 times the revenue of other participating companies.",
    url: "https://newsroom.accenture.com/news/2023/companies-that-lead-in-disability-inclusion-outperform-peers-financially-reveals-new-research-from-accenture",
    takeaway:
      "This research helps explain why disability inclusion belongs in conversations about business strategy. Evidence from an individual organization is still needed to understand its priorities and evaluate possible changes.",
    context:
      "The 2023 study analyzed 346 U.S. companies that participated in the Disability Equality Index from 2015–2022. The association does not establish causation or predict the return from a consulting project.",
  },
  {
    id: "employment-and-access",
    category: "Data",
    source: "U.S. Bureau of Labor Statistics",
    date: "March 2026 · 2025 data",
    value: "38.1%",
    metricLabel: "of U.S. people with a disability ages 16–64 were employed in 2025",
    cardNote: "An employment-to-population ratio, not an unemployment rate; based on 11 months of data.",
    title: "A broader view of workforce opportunity.",
    summary:
      "BLS reports that 38.1% of U.S. people with a disability ages 16–64 were employed in 2025.",
    url: "https://www.bls.gov/news.release/archives/disabl_03032026.htm",
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
    desc: "We can help your organization research a market, compare opportunities, and think through its next step.",
    detail:
      "A project could explore a market, compare similar organizations, or weigh options for a new program. We would agree on a focused business question with you, then use research to develop recommendations for your team to consider.",
    examples: [
      "Market and competitor research",
      "Program and growth opportunities",
      "Business cases and decision criteria",
    ],
  },
  {
    id: "accessibility",
    title: "Accessible experiences",
    desc: "We can help you explore barriers people may encounter when using your organization’s information, services, or programs.",
    detail:
      "A project could review a customer journey, compare how organizations share information, or research ways to make a program easier to access. The scope would depend on your goals, the information available, and what a student team can reasonably investigate.",
    examples: [
      "Websites and app experiences",
      "Documents and communications",
      "Events and program participation",
    ],
  },
  {
    id: "workplace",
    title: "Inclusive workplaces",
    desc: "We can help you research ways to make hiring, onboarding, and employee communication more inclusive.",
    detail:
      "A project could compare published workplace practices, review recruiting materials, or explore questions about the employee experience. Together, we would choose a manageable research question and identify the information needed to develop useful recommendations.",
    examples: [
      "Recruiting and hiring experiences",
      "Onboarding and employee communication",
      "Workplace practices and support",
    ],
  },
] as const;
