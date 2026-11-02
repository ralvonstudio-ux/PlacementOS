import type { PracticeCategory, PracticeDifficulty } from './practice.model';

export interface StarterQuestion {
  seedKey: string;
  category: PracticeCategory;
  questionType: 'mcq' | 'open_ended';
  difficulty: PracticeDifficulty;
  questionText: string;
  options?: string[];
  correctAnswer?: string;
  /** MCQ: worked solution. Open-ended: a model answer to learn the shape from. */
  explanation: string;
  guidancePoints?: string[];
  tags: string[];
}

const gd = (n: number, difficulty: PracticeDifficulty, questionText: string, guidancePoints: string[], explanation: string, tags: string[]): StarterQuestion => ({
  seedKey: `starter-gd-${n}`, category: 'gd', questionType: 'open_ended', difficulty, questionText, guidancePoints, explanation, tags: ['starter-pack', ...tags],
});

const pi = (n: number, difficulty: PracticeDifficulty, questionText: string, guidancePoints: string[], explanation: string, tags: string[]): StarterQuestion => ({
  seedKey: `starter-pi-${n}`, category: 'pi', questionType: 'open_ended', difficulty, questionText, guidancePoints, explanation, tags: ['starter-pack', ...tags],
});

const mcq = (
  category: 'aptitude' | 'reasoning',
  n: number,
  difficulty: PracticeDifficulty,
  questionText: string,
  options: string[],
  correctAnswer: string,
  explanation: string,
  tags: string[],
): StarterQuestion => ({
  seedKey: `starter-${category}-${n}`, category, questionType: 'mcq', difficulty, questionText, options, correctAnswer, explanation, tags: ['starter-pack', ...tags],
});

/** Starter content loaded once per institute (see practiceService.ensureStarterPack). Trainers and
 *  TPOs can edit, delete, or re-target every one of these like any question they add themselves. */
export const STARTER_QUESTIONS: StarterQuestion[] = [
  // ── Group Discussion (10) ─────────────────────────────────────────────────
  gd(1, 'medium', 'Will AI create more jobs than it destroys?', [
    'Open with a definition: automation vs augmentation — AI replaces tasks, not always whole jobs.',
    'For: new roles (ML engineer, prompt designer, data annotator), productivity gains, lower costs that grow demand.',
    'Against: routine clerical, support and entry-level coding work is at risk; reskilling lags behind the technology.',
    'Use one fact: past waves (ATMs, spreadsheets) reduced specific tasks but grew the overall industry.',
    'Conclude: net effect depends on reskilling speed — propose upskilling + policy support.',
  ], 'Model opening: "Before we pick a side, let us separate tasks from jobs. AI is very good at repetitive tasks, but most jobs are bundles of tasks, so the realistic outcome is job redesign rather than job extinction." Then give two points for each side, acknowledge the transition pain for entry-level roles, and close with: "The deciding factor is how fast we reskill — so the question is less \'will AI take jobs\' and more \'are we preparing people for the jobs AI creates\'."', ['technology', 'economy']),
  gd(2, 'easy', 'Work from home vs work from office: which is better for productivity?', [
    'Frame the criteria first: productivity, collaboration, learning for freshers, cost, well-being.',
    'WFH: no commute, focused deep work, wider talent pool, lower office cost.',
    'Office: mentoring, spontaneous ideas, culture, easier onboarding of freshers.',
    'Bring the hybrid model as the synthesis, with role-based flexibility.',
    'Conclude with a recommendation, not a fence-sit: e.g. freshers mostly in office, experienced staff hybrid.',
  ], 'Model opening: "I would like to suggest we judge this on four criteria — productivity, collaboration, learning and cost." Walk through each criterion briefly, note that freshers learn faster around seniors while experienced staff do deep work better at home, and summarise: "So the best answer is not either/or but a hybrid policy matched to role and experience."', ['workplace']),
  gd(3, 'easy', 'Social media: boon or bane for today\'s youth?', [
    'Define scope: connectivity, information, careers vs mental health, distraction, misinformation.',
    'Boon: learning, networking, small businesses, awareness campaigns, recruiter visibility (LinkedIn).',
    'Bane: screen addiction, comparison anxiety, cyber-bullying, fake news, privacy loss.',
    'Add a data point or example rather than opinion alone (e.g. screen-time or reach statistics you are sure of).',
    'Conclude: it is a tool — impact depends on usage; suggest digital literacy and time limits.',
  ], 'Model closing: "Social media is like a knife — in a chef\'s hand it feeds many, in careless hands it hurts. The real solution is not banning it but teaching digital literacy, setting time limits and curating who we follow." Keep it balanced and end with a practical action.', ['society', 'youth']),
  gd(4, 'medium', 'Should coding be a compulsory subject in schools?', [
    'For: computational thinking, job readiness, problem solving, equal access to future careers.',
    'Against: not every child needs it, teacher shortage, infrastructure gaps, risk of adding burden.',
    'Distinguish "computational thinking for all" from "programming for all".',
    'Mention implementation: phased rollout, teacher training, unplugged activities for low-resource schools.',
    'Conclude with a clear stance and conditions.',
  ], 'Model stance: "Compulsory basic computational thinking, optional advanced programming." Argue that logic and problem solving help every career, concede that infrastructure and teacher training are real barriers, and propose a phased rollout starting with unplugged activities in under-resourced schools.', ['education', 'technology']),
  gd(5, 'medium', 'Digital payments like UPI vs cash: is India ready for a cashless economy?', [
    'Strengths: UPI volume, financial inclusion, transparency, lower leakage, convenience.',
    'Gaps: rural connectivity, digital literacy, cyber-fraud, informal sector comfort with cash.',
    'Compare: cashless is not the same as less-cash — a hybrid is realistic.',
    'Suggest: offline UPI, awareness drives, strong grievance redressal, fraud protection.',
    'Conclude: India is ready in cities, getting ready in villages — support the transition.',
  ], 'Model structure: Opening (UPI success story) → Challenges (connectivity, literacy, fraud) → Way forward (offline modes, awareness, security) → Conclusion ("India is moving to less-cash, not no-cash, and policy should protect those who are still catching up").', ['economy', 'india']),
  gd(6, 'hard', 'Is a college degree still necessary to succeed in the modern job market?', [
    'Clarify "success": income, skills, stability, social recognition.',
    'Degree still matters: regulated professions, structured learning, network, many employers screen on it.',
    'Skills-first trend: portfolios, certifications, startups, open courses, skill-based hiring.',
    'Bring a balanced synthesis: degree opens doors, skills keep you in the room.',
    'Conclude with advice for the audience: degree + demonstrable skills.',
  ], 'Model closing: "A degree is the entry ticket and skills are the performance. Employers increasingly look for proof of what you can do — projects, internships, certifications — so the strongest candidate has both." Avoid extreme positions; show you understand both hiring realities and individual circumstances.', ['education', 'careers']),
  gd(7, 'medium', 'Climate change: whose responsibility is it — individuals or governments?', [
    'Start with scale: governments and industry control most emissions and infrastructure.',
    'Individuals matter: consumption, transport, waste, voting and demand shape the market.',
    'Examples: renewable policy, EV incentives, plastic bans vs household segregation, energy saving.',
    'Introduce shared but differentiated responsibility and the role of corporations.',
    'Conclude: policy sets the framework, individuals make it work.',
  ], 'Model summary: "Governments build the rails, individuals ride the train. Without policy, personal choices have limited reach; without personal action, policy does not succeed." Name one policy and one personal habit to show balance.', ['environment']),
  gd(8, 'medium', 'Startups vs MNCs: which is the better first job for a fresher?', [
    'Define what a fresher needs: learning, mentoring, brand, stability, pay.',
    'Startup: ownership, speed, varied exposure, equity; risks include instability and fewer processes.',
    'MNC: structured training, brand value, stability, benefits; risks include narrower scope and slower growth.',
    'Suggest decision factors: personality, financial needs, quality of the manager and team.',
    'Conclude with a framework rather than a one-size answer.',
  ], 'Model closing: "The right first job is the one with the best learning curve for you. If you need structure and stability, an MNC suits; if you thrive on ownership and ambiguity, a startup suits — and in both cases the manager and team matter more than the logo."', ['careers']),
  gd(9, 'hard', 'Case study: your company\'s product has a data breach affecting 1 lakh users. What should the leadership do first?', [
    'Priority order: contain the breach → protect users → communicate → fix root cause → learn.',
    'Contain: isolate systems, revoke credentials, involve security/forensics team.',
    'Communicate: transparent notification to users and regulators within legal timelines; no cover-up.',
    'Support users: password resets, credit monitoring, helpline.',
    'Prevent: root-cause analysis, audits, training, bug bounty; accountability at leadership level.',
  ], 'Model answer: "I would propose a sequence: first contain, then protect, then communicate, then fix, then learn." Justify each step in one line, stress honesty with users as a trust-building move, and end with ownership at leadership level. In case studies, a clear, ordered plan scores higher than many scattered ideas.', ['case-study', 'ethics']),
  gd(10, 'hard', 'Abstract topic: "Zero is more important than one."', [
    'Interpret before arguing: zero as a concept (place value, origin, baseline) vs one as a starting unit.',
    'Examples: binary system (0 and 1 both essential), zero error, zero hunger, zero waste, starting point of a journey.',
    'Contrast: one represents existence/action, zero represents potential/absence — each needs the other.',
    'Show creativity but stay structured: 2 interpretations, 2 examples, 1 conclusion.',
    'Conclude by stating your chosen interpretation clearly.',
  ], 'Model opening: "Let us interpret this before debating it — zero gave us place value, the number line and binary computing; without zero, one would have no scale." Use 2–3 crisp examples (computing, mathematics, goals like zero hunger), and conclude: "One begins something, but zero makes everything else measurable — so zero is the more foundational idea."', ['abstract']),

  // ── Personal Interview (10) ───────────────────────────────────────────────
  pi(1, 'easy', 'Tell me about yourself.', [
    'Use the Present → Past → Future structure, 60–90 seconds.',
    'Present: your course, college and one or two strongest skills.',
    'Past: a project, internship or achievement that proves those skills.',
    'Future: what you want to do next and why this role fits.',
    'Do not recite your resume line by line; avoid family history and personal details unrelated to the job.',
  ], 'Sample: "I am a final-year B.Tech student in Computer Science. I enjoy building practical web applications — in my final project I built a placement-tracking app using React and Node.js that is now used by my department. Earlier, I completed an internship where I fixed performance issues that cut page load time by 30%. I am now looking for a software role where I can keep learning from experienced engineers and contribute to real products." (Replace the details with your own.)', ['intro']),
  pi(2, 'easy', 'What are your strengths and weaknesses?', [
    'Pick 2 strengths that are relevant to the role and back each with a short example.',
    'Choose a real but non-critical weakness and show what you are doing to improve it.',
    'Avoid clichés like "I work too hard" or "I am a perfectionist" without substance.',
    'Never name a weakness that is essential for the job.',
  ], 'Sample: "My strengths are quick learning and consistency — I learned React in a month for a hackathon and delivered on time. A weakness is that I used to hesitate to speak in groups. I joined the college debate club and now present project updates every week, which has improved my confidence."', ['self-awareness']),
  pi(3, 'medium', 'Why should we hire you?', [
    'Match your skills to the job requirements — know the job description beforehand.',
    'Give 2–3 reasons: relevant skills, proof (project/internship), attitude to learn.',
    'Stay confident but not arrogant; do not compare yourself with other candidates.',
    'End with the value you will add to the team.',
  ], 'Sample: "Your role needs strong fundamentals in programming and the ability to learn quickly. I have solid data-structure skills — I have solved 300+ problems and built two full-stack projects — and I pick up new tools fast. I am also a reliable team member, and I would like to bring that energy to your team from day one."', ['motivation']),
  pi(4, 'medium', 'Why do you want to join our company?', [
    'Research the company: products, values, recent news, culture.',
    'Connect their work to your interests or skills — be specific.',
    'Mention growth, learning opportunities and the type of work, not only salary or brand.',
    'Avoid generic answers like "it is a big company".',
  ], 'Sample: "Your company\'s work in cloud-based solutions for banking interests me because I have worked on a secure payments mini-project. I also like that you run structured training programmes for freshers. I believe it is the right place to build a strong technical foundation while contributing to meaningful products."', ['company-research']),
  pi(5, 'medium', 'Where do you see yourself in five years?', [
    'Show ambition that is aligned with the role: skills, responsibility, contribution.',
    'Be realistic — mention becoming a strong contributor, then taking ownership of larger modules.',
    'Do not say you will start your own company or switch fields.',
    'Link your plan to what the company can offer.',
  ], 'Sample: "In five years, I would like to be a strong, dependable engineer who can own modules end to end and mentor new joiners. In the first two years I will focus on mastering the technology stack and delivering quality work. After that I hope to take more responsibility, possibly leading small projects, while continuing to upskill."', ['career-goals']),
  pi(6, 'medium', 'Tell me about a challenge or failure you faced and how you handled it.', [
    'Use the STAR method: Situation, Task, Action, Result.',
    'Pick a genuine example — academic, project or team related.',
    'Focus on what YOU did and what you learned.',
    'End with the positive outcome or the lesson that changed your approach.',
  ], 'Sample: "In our final-year project, our module failed integration a week before the demo (Situation). As the team lead I had to restore it quickly (Task). I organised a debugging session, split the issues by member and added automated checks (Action). We delivered the demo on time and I learned to integrate early and often (Result)."', ['star', 'behavioural']),
  pi(7, 'medium', 'Explain one project from your resume in detail.', [
    'Pick the project you know best; give a one-line summary first.',
    'Cover: problem, your role, tech stack and why, challenges, result.',
    'Be ready for follow-ups on design decisions, alternatives and what you would improve.',
    'Never claim work that you cannot explain.',
  ], 'Structure: "The project is X, built to solve Y. I handled the backend APIs in Node.js and MongoDB, chosen because of the flexible schema. The toughest challenge was Z, which I solved by ... The result was ... If I had more time I would add ..." Rehearse this for every project you list.', ['project', 'technical']),
  pi(8, 'hard', 'How do you handle conflict or disagreement in a team?', [
    'Show a calm, respectful approach: listen first, then present facts.',
    'Focus on the goal of the team, not on winning the argument.',
    'Give a real example with the resolution.',
    'Mention escalating only when needed.',
  ], 'Sample: "In a project, a teammate and I disagreed about the database choice. I listened to his reasons, then suggested we compare both options on performance and effort. After a quick prototype we chose the better one together. I learned that data and a shared goal resolve disagreements better than opinions."', ['teamwork', 'behavioural']),
  pi(9, 'hard', 'Are you comfortable with relocation, shifts or a service agreement? What are your salary expectations?', [
    'Be honest and flexible without sounding desperate.',
    'On salary, say you are open to the company\'s standard package for freshers, and focused on learning.',
    'Ask clarifying questions politely about terms instead of committing blindly.',
    'Do not quote a number unless you have researched the market.',
  ], 'Sample: "I am comfortable relocating wherever the role requires, and I understand that shifts can be part of the job. Regarding salary, I am sure the company offers a fair package for this role, and I am open to the standard structure. My priority is a role where I can learn and grow."', ['hr', 'negotiation']),
  pi(10, 'easy', 'Do you have any questions for us?', [
    'Always ask 1–2 thoughtful questions — never say "no questions".',
    'Good topics: training for freshers, team structure, growth path, tools and technologies.',
    'Avoid asking about salary, leave or perks at this stage.',
    'Do not ask something already answered on the website.',
  ], 'Sample questions: "What does the first six months look like for a new joiner on this team?" and "What qualities have made the most successful freshers in your organisation?" These show curiosity and long-term interest.', ['closing']),

  // ── Aptitude (10) ─────────────────────────────────────────────────────────
  mcq('aptitude', 1, 'easy', 'A train 150 m long crosses a pole in 15 seconds. What is its speed in km/h?', ['30 km/h', '36 km/h', '45 km/h', '54 km/h'], '36 km/h', 'Speed = distance / time = 150 / 15 = 10 m/s. Convert to km/h by multiplying by 18/5 (3.6): 10 × 3.6 = 36 km/h.', ['speed-distance-time']),
  mcq('aptitude', 2, 'easy', 'A can finish a job in 12 days and B in 18 days. In how many days will they finish it together?', ['6 days', '7.2 days', '8 days', '15 days'], '7.2 days', 'Work per day: 1/12 + 1/18 = (3 + 2)/36 = 5/36. Time = 36/5 = 7.2 days.', ['time-and-work']),
  mcq('aptitude', 3, 'easy', 'The price of an article is increased by 20% and then decreased by 20%. What is the net change?', ['No change', '4% decrease', '4% increase', '2% decrease'], '4% decrease', 'Take the price as 100. After +20%: 120. After −20% of 120: 120 × 0.8 = 96. Net change = 96 − 100 = −4%, i.e. a 4% decrease. Shortcut: x − y − xy/100 = 20 − 20 − 4 = −4.', ['percentages']),
  mcq('aptitude', 4, 'medium', 'What is the compound interest on ₹10,000 at 10% per annum for 2 years, compounded annually?', ['₹2,000', '₹2,100', '₹2,200', '₹2,310'], '₹2,100', 'Amount = 10000 × (1.1)² = 10000 × 1.21 = ₹12,100. CI = 12,100 − 10,000 = ₹2,100. (Simple interest would be ₹2,000.)', ['interest']),
  mcq('aptitude', 5, 'medium', 'A 40-litre mixture has milk and water in the ratio 3 : 1. How much water must be added to make the ratio 1 : 1?', ['10 litres', '15 litres', '20 litres', '30 litres'], '20 litres', 'Milk = 40 × 3/4 = 30 L; water = 10 L. For a 1 : 1 ratio, water must equal 30 L, so add 30 − 10 = 20 litres.', ['ratio-mixtures']),
  mcq('aptitude', 6, 'medium', 'The average of 5 numbers is 27. If one number is removed, the average of the remaining numbers is 25. What is the number removed?', ['30', '35', '40', '45'], '35', 'Sum of 5 numbers = 5 × 27 = 135. Sum of remaining 4 = 4 × 25 = 100. Removed number = 135 − 100 = 35.', ['averages']),
  mcq('aptitude', 7, 'medium', 'Two fair dice are thrown. What is the probability that the sum of the numbers is 8?', ['1/6', '5/36', '7/36', '1/9'], '5/36', 'Total outcomes = 36. Favourable outcomes for sum 8: (2,6), (3,5), (4,4), (5,3), (6,2) = 5. Probability = 5/36.', ['probability']),
  mcq('aptitude', 8, 'medium', 'A boat goes 12 km/h in still water and the stream flows at 4 km/h. How long will it take to travel 24 km upstream?', ['2 hours', '3 hours', '4 hours', '6 hours'], '3 hours', 'Upstream speed = 12 − 4 = 8 km/h. Time = 24 / 8 = 3 hours.', ['boats-streams']),
  mcq('aptitude', 9, 'easy', 'An article bought for ₹800 is sold for ₹920. What is the profit percentage?', ['12%', '14%', '15%', '18%'], '15%', 'Profit = 920 − 800 = ₹120. Profit % = (120 / 800) × 100 = 15%.', ['profit-loss']),
  mcq('aptitude', 10, 'hard', 'In how many distinct ways can the letters of the word LEVEL be arranged?', ['24', '30', '60', '120'], '30', 'LEVEL has 5 letters with L repeated twice and E repeated twice. Arrangements = 5! / (2! × 2!) = 120 / 4 = 30.', ['permutations']),

  // ── Reasoning (10) ────────────────────────────────────────────────────────
  mcq('reasoning', 1, 'easy', 'Find the next term: 2, 6, 12, 20, 30, ?', ['38', '40', '42', '44'], '42', 'Differences are 4, 6, 8, 10, so the next difference is 12: 30 + 12 = 42. (The terms are n × (n + 1): 1×2, 2×3, … 6×7 = 42.)', ['series']),
  mcq('reasoning', 2, 'easy', 'If CODE is written as DPEF, how is BANK written in the same code?', ['CBOL', 'CBNL', 'DBOL', 'CCOL'], 'CBOL', 'Each letter is shifted forward by one: C→D, O→P, D→E, E→F. So B→C, A→B, N→O, K→L, giving CBOL.', ['coding-decoding']),
  mcq('reasoning', 3, 'medium', 'Pointing to a man, Riya said, "He is the son of my mother\'s only brother." How is the man related to Riya?', ['Brother', 'Cousin', 'Nephew', 'Uncle'], 'Cousin', 'Riya\'s mother\'s only brother is Riya\'s maternal uncle. His son is therefore Riya\'s (maternal) cousin.', ['blood-relations']),
  mcq('reasoning', 4, 'easy', 'A man walks 5 km north, then 3 km east, then 5 km south. How far is he from the starting point?', ['3 km', '5 km', '8 km', '13 km'], '3 km', 'The north and south legs of 5 km cancel out, leaving only the 3 km east displacement. He is 3 km from the start.', ['direction-sense']),
  mcq('reasoning', 5, 'medium', 'Statements: All pens are books. Some books are cups. Conclusion: Some pens are cups. Does the conclusion follow?', ['Definitely true', 'Definitely false', 'Does not necessarily follow', 'Cannot be a conclusion'], 'Does not necessarily follow', 'Pens are fully inside books, and only some books overlap with cups. The cups may overlap the books that are not pens, so no definite link between pens and cups can be drawn — the conclusion does not necessarily follow.', ['syllogism']),
  mcq('reasoning', 6, 'easy', 'In a row of 20 students, Ravi is 7th from the left. What is his position from the right?', ['12th', '13th', '14th', '15th'], '14th', 'Position from right = total − position from left + 1 = 20 − 7 + 1 = 14th.', ['ranking']),
  mcq('reasoning', 7, 'hard', 'What is the angle between the hour and minute hands of a clock at 3:30?', ['60°', '75°', '90°', '105°'], '75°', 'At 3:30 the minute hand is at 180° (6 × 30). The hour hand is at 3 × 30 + 30/2 = 105°. The angle = 180 − 105 = 75°.', ['clocks']),
  mcq('reasoning', 8, 'easy', 'Find the odd one out: 8, 27, 64, 100, 125', ['27', '64', '100', '125'], '100', '8, 27, 64 and 125 are perfect cubes (2³, 3³, 4³, 5³). 100 is not a cube, so it is the odd one out.', ['odd-one-out']),
  mcq('reasoning', 9, 'medium', 'If 1 January 2025 is a Wednesday, what day of the week is 1 January 2026?', ['Wednesday', 'Thursday', 'Friday', 'Saturday'], 'Thursday', '2025 is not a leap year, so it has 365 days = 52 weeks + 1 odd day. The weekday moves forward by one: Wednesday → Thursday.', ['calendar']),
  mcq('reasoning', 10, 'hard', 'A father is three times as old as his son. After 12 years he will be twice as old as his son. What is the son\'s present age?', ['10 years', '12 years', '14 years', '16 years'], '12 years', 'Let the son be S and the father 3S. After 12 years: 3S + 12 = 2(S + 12) → 3S + 12 = 2S + 24 → S = 12 years (the father is 36).', ['ages']),
];
