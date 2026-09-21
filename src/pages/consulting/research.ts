/** Primary-source research is context, never a UBLDA outcome. */
export const RESEARCH = [
  {
    id: "disability-is-not-a-niche",
    category: "Perspective",
    source: "World Health Organization",
    date: "March 2023",
    checkedAt: "September 21, 2026",
    value: "1.3B",
    metricLabel: "people worldwide experience significant disability",
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
    checkedAt: "September 21, 2026",
    value: "1.6×",
    metricLabel: "the revenue for disability-inclusion leaders compared with other companies in the study",
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
    title: "Disability and employment in the United States.",
    summary:
      "BLS reports that 38.1% of U.S. people with a disability ages 16–64 were employed in 2025.",
    url: "https://www.bls.gov/news.release/archives/disabl_03032026.htm",
    takeaway:
      "Recruiting and workplace systems shape access to employment throughout the path from application to onboarding. Examining that experience can help an organization identify barriers within its own processes.",
    context:
      "This figure measures the share of the population that is employed. It is not an unemployment rate. BLS used 11 months of data because October 2025 was not collected. The annual estimate is not strictly comparable with other years.",
  },
  {
    id: "disability-in-the-workforce",
    category: "Data",
    source: "Boston Consulting Group",
    date: "May 2023",
    checkedAt: "September 21, 2026",
    value: "25%",
    metricLabel:
      "of employees surveyed reported a disability or health condition that limits a major life activity",
    title: "Disability is already part of the workforce.",
    summary:
      "In BCG’s survey of nearly 28,000 employees across 16 countries, about a quarter reported a disability or health condition that limits a major life activity.",
    url: "https://www.bcg.com/publications/2023/devising-people-strategy-for-employees-with-disabilities-in-the-workplace",
    takeaway:
      "Workplace inclusion starts with understanding the people already on a team. Accessible tools, flexible work and clear accommodation processes can help organizations respond to needs that employees may not have disclosed.",
    context:
      "BCG’s 2023 report draws on employee self-identification, including disabilities and health conditions that limit a major life activity. The survey covers nearly 28,000 employees in 16 countries. Its 25% finding describes that sample, not a census of every workplace. It uses a different population and definition from WHO’s global estimate.",
  },
  {
    id: "removing-hiring-barriers",
    category: "Research",
    source: "Ameri et al. · ILR Review",
    date: "March 2018",
    checkedAt: "September 21, 2026",
    value: "26%",
    metricLabel:
      "fewer expressions of employer interest when accounting applicants disclosed a disability in a field experiment",
    title: "Qualified talent can face barriers before the interview.",
    summary:
      "A field experiment involving 6,016 accounting job applications found 26% less employer interest in applications that disclosed a disability than in those that did not.",
    url: "https://journals.sagepub.com/doi/10.1177/0019793917717474",
    takeaway:
      "Hiring processes can overlook qualified candidates before they have a chance to demonstrate their skills. Reviewing selection criteria and making recruitment accessible helps employers examine where their own processes may exclude talent.",
    context:
      "Researchers from Rutgers, Syracuse and Binghamton sent fictional applications to accounting vacancies. Cover letters disclosed a spinal cord injury, disclosed an autism diagnosis using the terminology of the study, or did not mention disability. The 26% is a relative difference in expressions of employer interest, not a percentage-point gap or a hiring rate. The experiment concerns these roles and disability disclosures; it does not measure every disability or occupation. Published online in 2017 and in the March 2018 issue of ILR Review.",
  },
];

export const AREAS = [
  {
    id: "strategy",
    title: "Strategy & growth",
    desc: "A student team could research a market or compare options for a new program, giving your organization evidence to use in its business decisions.",
    detail:
      "For an organization considering a new program or a change in its business, a project could compare similar organizations, estimate demand, and examine the costs and trade-offs of different options. We would agree on the question and available information before deciding what the team can research in a semester.",
    examples: [
      "Market and competitor research",
      "Program and growth opportunities",
      "Business cases and decision criteria",
    ],
  },
  {
    id: "accessibility",
    title: "Accessible experiences",
    desc: "A project could examine the barriers disabled people encounter when using your services or information and compare ways your organization could address them.",
    detail:
      "A student team could review the steps involved in using a service, compare how organizations publish information, or research ways to make an event or program more accessible. The work would depend on the materials and input available to the team, with recommendations limited to what the research supports.",
    examples: [
      "Websites and app experiences",
      "Documents and communications",
      "Events and program participation",
    ],
  },
  {
    id: "workplace",
    title: "Inclusive workplaces",
    desc: "A student team could review hiring, onboarding, or employee communications to identify questions your organization should consider about disability access.",
    detail:
      "A project could compare published workplace practices or review recruiting and onboarding materials, using the findings to recommend changes for your organization to consider. We would define the question with your team and work within the information it can share.",
    examples: [
      "Recruiting and hiring experiences",
      "Onboarding and employee communication",
      "Workplace practices and support",
    ],
  },
] as const;
