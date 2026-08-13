import type { DirectoryProfile } from "./types"

type MemberSeed = Pick<DirectoryProfile, "memberId" | "displayName" | "schoolYear" | "major">

const leadership: DirectoryProfile[] = [
  { memberId: "member-preview-admin", displayName: "Sam Bodine", workspaceRole: "admin", clubRole: "Co-President", team: "Executive board", schoolYear: "2029", major: "Ross", isLeadership: true },
  { memberId: "member-community", displayName: "Alexa Chiang", workspaceRole: "member", clubRole: "Co-President", team: "Executive board", schoolYear: "2029", major: "Ross", isLeadership: true },
  { memberId: "member-membership", displayName: "Cooper Perry", workspaceRole: "member", clubRole: "Executive VP", team: "Executive board", schoolYear: "2029", major: "LSA", isLeadership: true },
  { memberId: "member-operations", displayName: "Lindsey Ye", workspaceRole: "member", clubRole: "VP of Operations", team: "Executive board", schoolYear: "Freshman", major: "LSA", isLeadership: true },
  { memberId: "member-finance", displayName: "Landon Miller", workspaceRole: "member", clubRole: "VP of Finance", team: "Executive board", schoolYear: "2029", major: "LSA", isLeadership: true },
  { memberId: "member-programming", displayName: "Alex Forstner", workspaceRole: "member", clubRole: "VP of Education", team: "Executive board", schoolYear: "Freshman", major: "Ross", isLeadership: true },
  { memberId: "member-communications", displayName: "Samantha Naber", workspaceRole: "member", clubRole: "VP Marketing and Communications", team: "Executive board", schoolYear: "2029", major: "Ross", isLeadership: true },
  { memberId: "member-partnerships", displayName: "Solomon DeYoung", workspaceRole: "member", clubRole: "VP Outreach and Partnerships", team: "Executive board", schoolYear: "2029", major: "Ross", isLeadership: true },
  { memberId: "member-events", displayName: "Andrew Sackett", workspaceRole: "member", clubRole: "VP Events and Programming", team: "Executive board", schoolYear: "2029", major: "Ross", isLeadership: true },
]

const members: MemberSeed[] = [
  { memberId: "member-molly-zann", displayName: "Molly Zann", schoolYear: "2029", major: "LSA" },
  { memberId: "member-gideon-post", displayName: "Gideon Post", schoolYear: "2029", major: "Ross" },
  { memberId: "member-xander-hemingway", displayName: "Xander Hemingway", schoolYear: "2029", major: "Ross" },
  { memberId: "member-mustafa-hasan", displayName: "Mustafa Hasan", schoolYear: "2029", major: "LSA" },
  { memberId: "member-adam-beydoun", displayName: "Adam Beydoun", schoolYear: "2029", major: "Ross" },
  { memberId: "member-angelo-diaz", displayName: "Angelo Diaz", schoolYear: "2029", major: "Ross" },
  { memberId: "member-diego-sanchez-ochoa", displayName: "Diego Sanchez-Ochoa", schoolYear: "2029", major: "SMTD" },
  { memberId: "member-joanna-huang", displayName: "Joanna Huang", schoolYear: "2029", major: "SMTD" },
  { memberId: "member-elena-kim", displayName: "Elena Kim", schoolYear: "2029", major: "SMTD" },
  { memberId: "member-daniel-theyss", displayName: "Daniel Theyss", schoolYear: "2029", major: "Ross" },
  { memberId: "member-weston-yesney", displayName: "Weston Yesney", schoolYear: "2029", major: "LSA" },
  { memberId: "member-sabrina-guttman", displayName: "Sabrina Guttman", schoolYear: "2029", major: "LSA" },
  { memberId: "member-katie-mcbrearty", displayName: "Katie McBrearty", schoolYear: "2029", major: "LSA" },
  { memberId: "member-katie-greenbaum", displayName: "Katie Greenbaum", schoolYear: "2029", major: "LSA" },
  { memberId: "member-chengli-hsieh", displayName: "Chengli Hsieh", schoolYear: "2029", major: "Kines" },
  { memberId: "member-charlie-vogel", displayName: "Charlie Vogel", schoolYear: "2029", major: "Kines" },
  { memberId: "member-daniel-wang", displayName: "Daniel Wang", schoolYear: "2029", major: "Ross" },
  { memberId: "member-abigail-eom", displayName: "Abigail J. Eom", schoolYear: "2029", major: "Engineering" },
  { memberId: "member-avy-wang", displayName: "Avy Wang", schoolYear: "2028", major: "Econ" },
  { memberId: "member-talia-wu-schanman", displayName: "Talia Wu Schanman", schoolYear: "2029", major: "LSA" },
  { memberId: "member-tanya-mene", displayName: "Tanya Mene", schoolYear: "2029", major: "LSA" },
  { memberId: "member-gemma-gow", displayName: "Gemma Gow", schoolYear: "2029", major: "Ross" },
  { memberId: "member-jonah-nourafchan", displayName: "Jonah Nourafchan", schoolYear: "2029", major: "LSA" },
  { memberId: "member-alex-cohen", displayName: "Alex Cohen", schoolYear: "2029", major: "LSA" },
  { memberId: "member-morgan-rothstein", displayName: "Morgan Rothstein", schoolYear: "2029", major: "LSA" },
  { memberId: "member-jacob-kligman", displayName: "Jacob Kligman", schoolYear: "2029", major: "LSA" },
  { memberId: "member-dylan-hosmer", displayName: "Dylan Hosmer", schoolYear: "2029", major: "LSA" },
  { memberId: "member-graham-johnson", displayName: "Graham Johnson", schoolYear: "2029", major: "Ross" },
  { memberId: "member-tommy-lu", displayName: "Tommy Lu", schoolYear: "2029", major: "LSA" },
  { memberId: "member-dhruv-chandna", displayName: "Dhruv Chandna", schoolYear: "2029", major: "LSA" },
  { memberId: "member-jake-rossow", displayName: "Jake Rossow", schoolYear: "2028", major: "LSA" },
  { memberId: "member-brett-hafkin", displayName: "Brett Hafkin", schoolYear: "2028", major: "LSA" },
  { memberId: "member-eitan-leshem", displayName: "Eitan Leshem", schoolYear: "2029", major: "LSA" },
  { memberId: "member-dylan-schmeidler", displayName: "Dylan Schmeidler", schoolYear: "2029", major: "Kinesiology" },
  { memberId: "member-sam-johnson", displayName: "Sam Johnson", schoolYear: "2029", major: "LSA" },
  { memberId: "member-luke-bykerk", displayName: "Luke Bykerk", schoolYear: "2029", major: "Ross" },
  { memberId: "member-ivan-franklin", displayName: "Ivan Franklin", schoolYear: "2029", major: "LSA" },
  { memberId: "member-zack-slater", displayName: "Zack Slater", schoolYear: "2029", major: "Ross + LSA" },
  { memberId: "member-stellan-edvardsson", displayName: "Stellan Edvardsson", schoolYear: "2028", major: "LSA" },
  { memberId: "member-juwon-kim", displayName: "Juwon Kim", major: "Exchange" },
  { memberId: "member-hyewon-cho", displayName: "Hyewon Cho", major: "Exchange" },
  { memberId: "member-blake-stasinski", displayName: "Blake Stasinski", schoolYear: "2029" },
  { memberId: "member-alexander-tangorra", displayName: "Alexander Tangorra", schoolYear: "2028", major: "LSA" },
  { memberId: "member-anna-vega", displayName: "Anna Vega", schoolYear: "2028", major: "LSA" },
  { memberId: "member-alexis-ruiz", displayName: "Alexis Ruiz", schoolYear: "2029", major: "Ross" },
  { memberId: "member-josh-fink", displayName: "Josh Fink", schoolYear: "2029", major: "Economics" },
  { memberId: "member-sophia-de-leone", displayName: "Sophia de Leone", schoolYear: "2027", major: "Exchange" },
  { memberId: "member-noah-findling", displayName: "Noah Findling", schoolYear: "2027", major: "LSA" },
  { memberId: "member-catherine-alcantara", displayName: "Catherine Alcantara", schoolYear: "2028", major: "Ross" },
  { memberId: "member-whalan-eid", displayName: "Whalan Eid", schoolYear: "Freshman", major: "Ross" },
  { memberId: "member-isaac-shapiro", displayName: "Isaac Shapiro", schoolYear: "Freshman", major: "Ross" },
  { memberId: "member-jonathan-diaz", displayName: "Jonathan Diaz", schoolYear: "Freshman", major: "Ross" },
  { memberId: "member-ryan-rice", displayName: "Ryan Rice", schoolYear: "Freshman", major: "LSA" },
  { memberId: "member-james-somero", displayName: "James Somero", schoolYear: "Sophomore", major: "LSA" },
  { memberId: "member-jake-pazin", displayName: "Jake Pazin", schoolYear: "Freshman", major: "Ross, SMTD" },
  { memberId: "member-abram-freilich", displayName: "Abram Freilich", schoolYear: "Freshman", major: "LSA" },
  { memberId: "member-tommy-hartnett", displayName: "Tommy Hartnett", schoolYear: "Freshman", major: "LSA" },
]

const generalMembers: DirectoryProfile[] = members.map((member) => ({
  ...member,
  workspaceRole: "member",
  clubRole: "Member",
  team: "General membership",
  isLeadership: false,
}))

export const workspaceDirectory = [...leadership, ...generalMembers]

const normalizedName = (value: string) => value.trim().toLocaleLowerCase()

export function mergeWorkspaceDirectory(livePeople: DirectoryProfile[]) {
  const liveByName = new Map(livePeople.map((person) => [normalizedName(person.displayName), person]))
  const seededNames = new Set(workspaceDirectory.map((person) => normalizedName(person.displayName)))
  const seededPeople = workspaceDirectory.map((person) => {
    const livePerson = liveByName.get(normalizedName(person.displayName))
    return livePerson ? { ...person, ...livePerson } : person
  })
  const liveOnlyPeople = livePeople.filter((person) => !seededNames.has(normalizedName(person.displayName)))

  return [...seededPeople, ...liveOnlyPeople]
}
