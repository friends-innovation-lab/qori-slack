# Stakeholder Interview Notes — Jane Chen, Engineering Lead
**Date:** February 24, 2026
**Duration:** 52 minutes
**Interviewer:** Lapedra Tolson
**Format:** Remote (Zoom)

---

## Warm-Up

Been on the VA Mobile team 3.5 years. Started as senior engineer, promoted to lead about 18 months ago. "I inherited a lot of architectural decisions I wouldn't have made." Team of 7 engineers — 4 iOS/Android, 2 backend, 1 DevOps.

Her team owns: navigation framework, core UI components, authentication flow, and the integration layer with VA.gov APIs. Does NOT own content or feature-specific screens — those are owned by product verticals (Health, Benefits, Claims).

Typical week: 40% code review and architecture decisions, 30% meetings with product verticals, 20% firefighting production issues, 10% actual coding. "I wish those numbers were reversed."

Proud of: migration to React Native 0.72 last year. "That was a 6-month effort and we didn't break anything in production." Also proud of crash rate — down from 4.2% to 0.8% in the last year.

What keeps her up: "The navigation. Honestly. I know it's broken and I know WHY it's broken but fixing it means touching everything. Every vertical team has built on top of the current nav architecture. It's load-bearing technical debt."

## Context & Perspective

On the 45% abandonment: "I'm surprised it's not higher honestly." She thinks it's three things:
1. The hamburger menu is a "junk drawer" — 23 top-level items, no hierarchy logic
2. Deep linking from notifications drops users into screens with no back path — "they literally can't get home"
3. The tab bar disappears on certain screens due to a bug in React Navigation 6 that they've been unable to fix for 8 months

**Key quote:** "Veterans are more patient than commercial app users. If this were a banking app with these nav metrics, we'd have zero users. They stick with it because they HAVE to, not because it works."

On back stack corruption (12K users/month): "This is my nightmare bug." It's caused by the interaction between React Navigation's stack navigator and their custom deep link handler. When a push notification opens a screen that's already in the stack, it creates a duplicate entry. The back button then cycles between two identical screens. "Users tap back and end up exactly where they started. They tap back again, same screen. They think the app is frozen."

Has tried to fix it 3 times. Each fix broke something else. "The deep link handler was written by someone who left 2 years ago. It's 1,200 lines of spaghetti with no tests."

On disappearing tab bar (3.2K users/month): Related but different root cause. React Navigation 6 has a known issue where the tab bar visibility state gets corrupted when navigating between nested stack navigators. "We hide the tab bar on certain detail screens — that's by design. But sometimes it doesn't come BACK when you return to the parent screen." The fix requires upgrading to React Navigation 7, which is a "massive lift" — estimated 3-4 weeks of dedicated engineering time.

On 7.3 taps per task: "That's architecture AND design. But architecture first." The VA.gov APIs return data in a way that forces hierarchical screens. Example: to get prescription details, you have to call the health API, then the pharmacy sub-API, then the prescriptions endpoint, then the individual prescription. "Each API call maps to a screen in the current architecture because the original developers built it that way. It doesn't HAVE to be that way."

**Key quote:** "The API returns data hierarchically. But that doesn't mean the UI has to mirror the API structure. That's a design choice someone made 4 years ago that became gospel."

On features buried 4+ screens deep: "Prescription refill is the worst example. Home → Health → Pharmacy → Prescriptions → [specific med] → Refill. Six taps. It could be a button on the home screen with one API call." The backend can handle it — there's a direct refill endpoint. Nobody built the shortcut because the navigation architecture assumes hierarchical browsing.

## Role-Specific Deep Dive

Current navigation architecture: React Native with React Navigation 6. Hamburger menu (drawer navigator) as the primary nav pattern, with nested stack navigators for each section. "It's drawers inside stacks inside tabs. Every screen is at least 3 layers deep."

They use a custom navigator wrapper that adds analytics tracking and error boundaries. "That wrapper is both our best and worst code. Best because it catches crashes. Worst because it adds complexity to every navigation action."

Integration with VA.gov: REST APIs through a middleware layer called "vets-api." Every API call goes through vets-api, which handles auth tokens and data transformation. "Navigation is slow partly because vets-api adds 200-400ms to every call. When you're making 3 calls to render a screen, that's over a second of loading before the user sees anything."

On 19.3% search success rate: "Search is embarrassing. I'll be honest." Current implementation: basic string matching against a hardcoded JSON file of screen titles. "It's not even hitting the backend. It's literally searching a static list of 47 screen names." 40% of content missing because nobody maintains the JSON file when new screens ship. "Each vertical team ships screens without updating the search index because it's a manual process."

What it would take to fix: "Real search needs a backend index. VA.gov has an Elasticsearch instance but mobile doesn't have access to it. We'd need to request that integration, go through the security review, get an ATO amendment. That's 3-4 months minimum just for the approval."

On accessibility (47 of 78 WCAG failures): "Most of those are component-level. Our custom components — the ones we built ourselves — have okay accessibility. The problem is third-party components and the navigation library itself." React Navigation's drawer doesn't announce state changes to screen readers. Tab bar focus order is wrong after the disappearing tab bug. "When the tab bar reappears, VoiceOver doesn't know it's there. The user has to scrub the entire screen to find it."

**Key quote:** "We're not failing accessibility because we don't care. We're failing because fixing it in React Navigation requires forking the library. We've forked it twice already for other bugs. Each fork makes upgrades harder."

On form state loss: "That's a React Native lifecycle issue. When the app goes to background on iOS, the OS can kill inactive screens to free memory. We're not persisting form state to AsyncStorage because — honestly — nobody implemented it. It's maybe 2 weeks of work but it keeps getting deprioritized."

Navigation patterns explored but killed:
- **Bottom tab bar** (prototyped 18 months ago): Killed because VA design system mandated hamburger. "I argued for tabs. Hard. The design system team said hamburger was the standard. That was before the data showed how bad it was."
- **Hub and spoke from home** (prototyped 8 months ago): Killed by scope — would've required refactoring every vertical team's navigation. "It was the right architecture but the wrong time. We couldn't get all 4 vertical teams to commit to the migration simultaneously."
- **Bottom sheet navigation** (explored, never prototyped): Ruled out — too custom, no React Navigation support.

On 6 levels vs competitors' 3: "100% frontend architecture decisions. The API doesn't force 6 levels. We could flatten to 3 levels in the frontend if we pre-fetched data and used smarter screen composition. The backend team would barely notice."

## Constraints & Blockers

Biggest technical constraints for any redesign:
1. **React Navigation 6** — they're stuck on it until the tab bar bug is fixed OR they upgrade to 7. Either way it's significant work.
2. **VA Design System compliance** — any nav pattern change needs design system approval. "The design system team moves slowly. If we propose tabs, it'll be 2-3 months before they approve the pattern."
3. **vets-api middleware latency** — 200-400ms per call constrains how many data sources a single screen can aggregate.
4. **ATO (Authority to Operate)** — any new integration (like Elasticsearch for search) requires security review. "ATO is the speed of government. Budget 3 months minimum."
5. **Vertical team buy-in** — navigation changes affect every team. "Last time we tried a cross-cutting change, it took 6 weeks just to get all 4 teams in the same meeting."

On implementing tab navigation: "Technically straightforward. Tab navigator is built into React Navigation. We could have a prototype in a week. The blocker is political — design system approval and vertical team migration. If research proves tabs are better, that gives us the ammunition to push it through."

**Key quote:** "Give me research data that says tabs reduce abandonment by X%. That's what I need to take to the design system team and say 'your hamburger standard is costing veterans Y hours per month.'"

On what would make recommendations impossible:
- "Don't recommend a custom gesture-based navigation. We don't have the engineering bandwidth to build and maintain custom nav components."
- "Don't recommend anything that requires backend API restructuring. vets-api changes take 6+ months and involve 3 different teams."
- "Don't recommend we switch away from React Native. That's a non-starter."

## Priorities & Success

Successful nav improvement for Q1 2026:
1. Reduce navigation depth from 6 to 3 levels for top 10 tasks
2. Fix the back stack corruption bug
3. Fix the disappearing tab bar (upgrade to React Navigation 7)
4. Get search success rate above 60%
5. Pass at least 60 of 78 WCAG criteria

Performance metrics that matter to her team: time-to-interactive per screen (currently 1.8s average, wants under 800ms), navigation error rate (currently 3.2%, wants under 0.5%), crash rate related to navigation (currently 0.3% of sessions).

On reducing support burden: "Fix back stack corruption and you eliminate probably 40% of nav-related support tickets overnight. That's the highest-impact single fix." Second: surface prescription refill and claims status on the home screen. "Those two features generate the most help desk calls about 'where do I find X.'"

Questions she wants research to answer:
1. "Do users actually want a bottom tab bar? Or is that just what we assume because other apps use it?"
2. "What are the top 5 tasks veterans do most frequently? I think I know but I want data."
3. "How do screen reader users actually navigate the app today? We've never watched someone do it."
4. "Would a 'recents' or 'favorites' feature reduce navigation steps more than restructuring?"

## Closing

Things she wished I'd asked about:
- Offline support. "25% of our users are in rural areas with bad connectivity. Navigation breaks differently when API calls fail. The hamburger menu loads but the screens behind it timeout. Users see a menu of options that don't work."
- Performance on older devices. "We test on iPhone 14 and Pixel 7. A lot of veterans have iPhone 8s or Galaxy S9s. Navigation animations lag significantly on those devices."

Who else to talk to:
- **Marcus Williams** — Backend lead for vets-api. Knows the API constraints intimately. "He'll tell you things about data structure that explain half the navigation issues."
- **Dr. Patricia Hernandez** — Accessibility specialist on the design system team. "She's been pushing for nav accessibility fixes for a year. She has a prioritized list."
- **Tom Nakamura** — Product owner for the Health vertical. "His team has the most screens and the deepest navigation. If you can fix nav for Health, you've fixed the hardest case."

---

## Researcher Observations

- Jane is frustrated. She clearly knows the problems and has ideas for solutions but feels blocked by organizational process and cross-team coordination.
- Strong advocate for tab-based navigation — has been pushing internally for 18 months. Research data would give her leverage.
- The deep link/back stack bug seems like the highest-impact fix. She lit up when talking about it — this clearly causes her team pain daily.
- Interesting that she frames the 6-level depth as a frontend choice, not a backend constraint. This suggests architectural redesign is more feasible than expected.
- She's very data-driven. Frame research findings in metrics she cares about: time-to-interactive, error rates, WCAG pass rate. Don't give her qualitative-only findings.
- Offline navigation is a blind spot in our current research plan. Need to add a task for poor-connectivity scenarios.
- Her suggestion about "recents/favorites" is worth testing. Could be a lower-effort alternative to full restructuring.
