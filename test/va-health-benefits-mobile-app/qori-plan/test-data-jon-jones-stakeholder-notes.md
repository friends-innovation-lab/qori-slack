# Stakeholder Interview Notes — Jon Jones, Senior Designer
**Date:** February 25, 2026
**Duration:** 47 minutes
**Interviewer:** Lapedra Tolson
**Format:** Remote (Zoom)

---

## Warm-Up

At VA OCTO for 2 years. Before that, 6 years at USDS working on IRS and SSA digital products. "Government mobile is a different beast. You're designing for people who didn't choose your product — they need it." Focuses on core navigation, home screen, and the design system components that all verticals use.

When nav issues come up, he's usually pulled in by product managers who've gotten escalations from the contact center. "The pattern is always the same — PM gets a spike in tickets, asks me to look at it, I trace it back to a navigation path that's 5 screens too deep." Works closely with Jane Chen on engineering constraints and Patricia Hernandez on accessibility. "Patricia and I are basically a two-person advocacy team for fixing nav. We've been making the case for a year."

Government mobile design vs. commercial: "You can't A/B test on veterans. You can't ship something broken and iterate fast. If claims navigation breaks, a veteran might miss a benefits deadline. The stakes are real in a way that a shopping app's navigation never is."

## Context & Perspective

On 54.8% completion / 7.3 taps: "Seven taps is insane. The rule of thumb is 3 taps max for any primary task. We're more than double." He thinks it's driven by two things:

1. **Category-first architecture** — the app forces users to know whether something is "Health" or "Benefits" before they can do anything. "Veterans don't think that way. They think 'I need my prescription' or 'where's my payment.' They don't categorize their own life into VA org chart buckets."

2. **No shortcuts** — there's no way to jump to a task. No favorites, no recents, no shortcuts on the home screen. "Every session starts from the hamburger. Every time."

**Key quote:** "We designed the app around the VA's organizational structure, not around veteran tasks. That's the original sin. Everything else is a symptom."

On prescription refill path (4+ screens): "I wasn't here when that was designed, but I've studied it. The path mirrors the API structure — Home → Health → Pharmacy → Prescriptions → [Med] → Refill. The original designers mapped screens 1:1 to API endpoints. It was probably expedient at the time. Now it's the most complained-about flow in the app."

He's sketched alternatives: a "Quick Actions" row on the home screen with 4-6 common tasks including Refill. "I mocked it up 8 months ago. It tested well in an informal card sort with 5 people. But implementing it requires home screen redesign and that got scoped out of the last two releases."

On direct deposit (58.3% failure) and travel reimbursement (61.8% failure): "Direct deposit is hidden. It's under Profile → Personal Information → Direct Deposit. That's not where ANY user would look for it. It should be under Payments or on the home screen." Travel reimbursement is worse — it's technically a separate system (BTSSS) with its own auth flow. "Users start in the VA app, get redirected to a web view that looks completely different, lose their navigation context, and have no way back. We're literally ejecting them from the app."

**Key quote:** "Travel reimbursement isn't a navigation problem, it's an integration problem. We're duct-taping a web app inside a mobile app and calling it a feature."

On 17% category-based mental models: "That matches everything I've seen. We did a tree test last year — 23 participants. When we organized tasks by VA department (Health, Benefits, Claims), success rate was 34%. When we organized the same tasks by verb (Check, Manage, Apply, Track), success rate jumped to 71%. We have the data. It's just never been prioritized."

**Key quote:** "Veterans think in verbs, not nouns. 'Check my claim.' 'Refill my meds.' 'Track my appeal.' We organized the app in nouns."

On search: "Search was an afterthought. I'll be honest about that. We had 2 weeks to add it before a release. The PM said 'just add a search bar.' So we indexed screen titles into a JSON file. No synonyms, no fuzzy matching, no natural language. If you type 'meds' instead of 'prescriptions,' you get nothing." He considers it "actively harmful" because it trains users to not trust search. "Once someone searches twice and gets nothing, they never search again. We've trained learned helplessness."

## Role-Specific Deep Dive

On accessibility (47 of 78 WCAG failures): "The nav failures are the worst ones because they're structural, not cosmetic. You can fix a color contrast issue in an afternoon. You can't fix 'VoiceOver skips the entire Benefits section' without rearchitecting the drawer navigator."

Specifics he knows about:
- Drawer navigator doesn't announce open/close state changes
- When drawer closes, focus returns to the wrong element (first screen element, not the trigger button)
- Tab bar icons have no accessible labels in certain states
- Nested stack navigators create a confusing reading order for screen readers — "VoiceOver reads the back button, then the header, then jumps to the bottom of the screen, then reads the content. It's like reading a newspaper by column instead of by story."

**Key quote:** "A sighted user can recover from bad navigation by looking around. A screen reader user in our app is basically navigating a maze blindfolded. There's no landmark structure, no skip navigation, no way to orient yourself."

Design system components: they use VA Mobile Design System (VAMDS), which is built on React Native components. "The design system has good atomic components — buttons, inputs, cards. But the navigation components are weak. The drawer was custom-built outside the design system. The tab bar is a fork of React Navigation's default. Neither follows VAMDS patterns."

On 6 levels vs. 3: "There's no design rationale for 6 levels. It happened incrementally. V1 had 3 levels. Then Health added sub-sections. Then Benefits added sub-sub-sections. Then Claims got a detail flow. Nobody designed 6 levels — it accreted." Each vertical team added depth independently. "Nobody had oversight of the full tree. I started mapping it last quarter. I was shocked — there are 142 unique screens across 6 levels. The home screen links to 8 sections, each 3-5 levels deep."

**Key quote:** "Six levels isn't a design decision. It's the absence of one."

Navigation patterns explored:
- **Bottom tabs** — he's prototyped three versions. 4-tab (Home, Health, Benefits, Profile), 5-tab (adding Messages), and 4-tab with a "More" overflow. "I prefer the 4-tab with More. It covers 80% of tasks in the tabs and puts everything else one tap away." Killed by design system team — "they said hamburger is the VA mobile standard. Full stop."
- **Task-based home screen** — the Quick Actions concept. Cards for top 6 tasks based on the user's actual usage patterns. "Personalized home screen. Show refill if you refill monthly. Show claims if you have an active claim. Hide what's irrelevant." Killed by scope/timeline.
- **Spotlight search** — iOS-style search that indexes content, not just screen names. Includes synonyms ("meds" → prescriptions, "money" → direct deposit). Never prototyped because engineering said search backend wasn't available.
- **Breadcrumb navigation** — showing path context so users know where they are. Prototyped but looked cluttered on mobile. "Breadcrumbs work on desktop. On a 375px screen, you're showing Home > Health > Pharmacy > Prescriptions in 11px type. It's unreadable."

On tab vs. hamburger data: "I know the research. Tabs win. Luke Wroblewski documented this a decade ago. Nielsen Norman Group says the same thing. Our own tree test showed it. The hamburger persists because it was the VA design system decision in 2021 and nobody has formally revisited it."

On dark mode icon issues: "We rushed dark mode. The icons are SVGs with hardcoded fill colors. In light mode they're dark gray on white — fine. In dark mode they're dark gray on dark gray — invisible. The fix is using semantic color tokens. We have the tokens in the design system. They're just not applied to nav icons yet. It's maybe 2 days of design work and a week of engineering."

On pogo-sticking between Health and Benefits: "That's the clearest signal that the category structure is wrong. If users are bouncing back and forth, they don't know which bucket their task is in. Success would look like: users go to the right section on the first try at least 80% of the time. Right now I'd guess it's under 50%."

## Constraints & Blockers

Technical constraints on redesign:
- React Navigation 6 limitations (same as Jane mentioned)
- iOS and Android handle tab bars differently — "iOS puts tabs at bottom natively. Android's Material Design puts them at top. If we do tabs, we need to decide: native per-platform or unified? Unified is easier to maintain but feels non-native on one platform."
- Screen count — 142 screens can't all move at once. "Any redesign has to be incremental. You can't freeze the app for 3 months while we reorganize everything."

VA-specific design requirements:
- Must follow VA Mobile Design System (VAMDS) — but the design system team is open to proposals if backed by research. "They're not unreasonable. They just want evidence."
- Must maintain parity between iOS and Android — "if it works on one platform, it works on both. No platform-exclusive features."
- Privacy requirements limit what can appear on home screen — "we can't show claim amounts, appointment details, or medication names on a screen that might be visible to others. Home screen shortcuts have to be generic: 'Refill' not 'Refill Metformin 500mg.'"

Organizational factors:
- 4 vertical teams own their sections. Nav changes affect all of them. "Getting 4 PMs, 4 tech leads, and 4 design leads to agree on a nav structure is a 2-month exercise in politics."
- VA leadership wants to see metrics improvement. "They're measuring us on app store ratings, contact center volume, and task completion. If we can show nav changes move those numbers, we get executive air cover."
- Congressional interest — "The VA mobile app was mentioned in a Congressional hearing about veteran access to digital services. There's political visibility. That cuts both ways — it means leadership cares, but it also means we can't ship something that breaks."

**Key quote:** "Research is my ammunition. If you can prove that tab navigation reduces abandonment from 45% to something significantly lower, I can take that to the design system team and to VA leadership. Right now I have opinions. I need evidence."

## Priorities & Success

If he could fix ONE thing: "Put the top 5 veteran tasks on the home screen. Don't make them dig through a menu. Refill prescription, check claim status, view appointments, send a secure message, update direct deposit. Five buttons on the home screen. That single change would probably cut abandonment by a third."

On prioritizing accessibility vs. usability: "They're the same thing. Fixing navigation for screen reader users fixes it for everyone. If we add proper landmark structure and skip navigation, that helps keyboard users AND it forces us to simplify the hierarchy. Accessible design IS good design. I'm tired of accessibility being treated as a separate workstream."

**Key quote:** "Don't give me an accessibility section at the end of the report. Weave it into every finding. If a navigation pattern fails for screen reader users, it's a bad pattern. Period."

Success metrics he wants to see:
- Task completion above 80% (currently 54.8%)
- Average taps under 4 for top 10 tasks (currently 7.3)
- WCAG pass rate above 85% (currently 60%)
- App Store rating above 4.0 (currently 2.8 for navigation-related reviews)
- Contact center nav tickets down 50% (currently 2,287/month)

Questions he wants research to answer:
1. "What are the actual top 10 tasks veterans do, ranked by frequency? Not what we think — what the data shows."
2. "How do veterans describe what they're looking for? What words do they use? That informs our IA and search."
3. "Does tab navigation actually work better for OUR users, or is that just general mobile best practice? Veterans are not typical mobile users — they're often older, often have disabilities, often on older devices."
4. "What's the minimum viable navigation change that would move task completion above 70%? I need a 'start here' recommendation, not a grand redesign."

## Closing

Things he wished I'd asked:
- How the notification system interacts with navigation. "Push notifications deep-link users into random screens with no way to navigate to related content. A veteran gets a notification about a prescription being ready, taps it, sees the prescription detail, but can't easily get to the refill button from there. The notification solves one problem and creates another."
- Onboarding. "New users have zero orientation. They download the app, log in through ID.me (which is its own nightmare), and land on a home screen that tells them nothing about what's available or where to find things. First impressions are everything and we're wasting it."

Who else to talk to:
- **Patricia Hernandez** — "Already mentioned her. She's essential. She has audit data on every accessibility failure."
- **Sarah Kim** — Product Manager for the home screen. "She controls what goes on the most valuable real estate in the app. She'd give you the product perspective on why the home screen is the way it is."
- **Marcus Williams** — Backend lead. Same referral as Jane. "He knows why certain navigation paths are slow. If you're wondering why a screen takes 3 seconds to load, Marcus is your answer."

---

## Researcher Observations

- Jon is aligned with Jane on the tab navigation recommendation. They're clearly a coalition. Research data supporting tabs would unblock an organizational logjam.
- The tree test data he mentioned (34% vs 71% success rate, category vs. verb-based organization) is powerful existing evidence. Need to get that study and cite it in our research plan.
- His framing of "veterans think in verbs" is a strong insight that should inform discussion guide task framing. Don't ask participants to "find the Health section" — ask them to "refill your prescription."
- He's frustrated by the design system team blocking tab navigation. There's organizational tension there. Our research needs to be rigorous enough to settle the debate.
- The privacy constraint on home screen shortcuts is important — can't show PII in quick actions. This affects our recommendations.
- His point about accessibility being inseparable from usability should shape how we structure findings. No separate accessibility section — integrate throughout.
- 142 screens across 6 levels is a concrete number worth citing. Shows the scope of the IA problem.
- Notification-to-navigation is a use case we should add to the discussion guide. Deep link testing should be part of the session tasks.
- Both Jon and Jane independently recommended Patricia Hernandez and Marcus Williams. Confirms they're critical voices.
