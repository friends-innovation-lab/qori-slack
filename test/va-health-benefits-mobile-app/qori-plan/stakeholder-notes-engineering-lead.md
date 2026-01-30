# Stakeholder Interview Response

> **Study:** VA Health and Benefits Mobile App
> **Stakeholder:** Tomás Rivera, Engineering Lead
> **Date:** January 27, 2026
> **Duration:** 52 minutes
> **Interviewer:** Research Team

---

## Participant Profile

| | |
|---|---|
| **Name** | Tomás Rivera |
| **Role** | Engineering Lead, VA Mobile App Team |
| **Tenure** | 4 years at VA, 15 years in mobile development |
| **Team Size** | 12 engineers (6 iOS, 4 Android, 2 backend) |
| **Primary Focus** | Mobile architecture, API integration, performance optimization, accessibility implementation |

---

## Opening Context

**"Can you tell me about your role and how you work with the mobile app team?"**

> "I lead the mobile engineering team for the VA Health and Benefits app. We're responsible for both iOS and Android implementations, plus coordinating with the backend teams who provide our APIs.
>
> My day-to-day is split between technical leadership—architecture decisions, code reviews, performance optimization—and people management. I spend a lot of time in meetings translating between what product and design want and what's technically feasible given our constraints.
>
> The biggest part of my job that people don't see is **dependency management**. We don't control our own backend. We consume APIs from VHA systems, VBA systems, identity services, and more. Each of those teams has their own priorities and release schedules. A lot of my work is coordinating across those boundaries.
>
> When something breaks or is slow, users blame the app. But often the issue is three layers deep in a system we can't modify."

---

## Section 1: Technical Architecture Constraints

### Question 1: Backend Dependencies

**"What technical constraints most affect your engineering decisions?"**

> "**API latency** is our biggest challenge. The VA backend systems weren't designed for mobile. They were designed for batch processing and desktop web applications where a 5-second response is acceptable. On mobile, that's death.
>
> Our claims status API, for example, aggregates data from multiple VBA systems. Each hop adds latency. By the time the response reaches the app, we're looking at 8-12 seconds on average. Some users on poor connections see 20+ seconds.
>
> We've implemented aggressive caching, but the data freshness requirements limit how much we can cache. A veteran checks their claim status because they want *current* information. Showing them data from an hour ago defeats the purpose.
>
> **API pagination** is another pain point. Some endpoints return huge payloads—a veteran with 10 years of prescriptions might have 500+ records. The API wasn't designed with mobile data constraints in mind. We had to implement client-side pagination and lazy loading to make it work.
>
> The **authentication layer** is complex. We support Login.gov and ID.me, each with their own token management. Refresh flows, session extension, biometric re-authentication—there's a lot of state to manage. When something goes wrong in auth, users get logged out unexpectedly. Those are our most common support tickets."

**Follow-up: "How do these constraints show up in the veteran experience?"**

> "Loading spinners. Everywhere. Veterans see a lot of loading states because we're waiting on backend responses we can't speed up.
>
> We've done everything we can on the client side—skeleton screens, progressive loading, optimistic UI updates. But you can only polish a slow API so much. If the data takes 10 seconds to arrive, the user waits 10 seconds.
>
> The authentication issues are worse because they're unpredictable. A veteran might be in the middle of checking their appointments when their session expires. From their perspective, the app just stopped working. The error messages we can show are generic because the actual auth errors from the backend are technical and meaningless to users."

---

### Question 2: Platform Divergence

**"How do you handle developing for both iOS and Android?"**

> "We maintain two separate native codebases. We evaluated cross-platform frameworks—React Native, Flutter—but the accessibility requirements pushed us toward native. Screen reader support, in particular, is more reliable and predictable with native implementations.
>
> The downside is that **every feature is built twice**. We have shared design specs, but iOS and Android behave differently. Gestures, navigation patterns, system integrations—they diverge. Sometimes we ship features on one platform first while the other catches up.
>
> **Release cycles** are another challenge. Apple's App Store review can take days, sometimes a week. Google Play is usually faster but less predictable. We can't do true simultaneous releases, so we stagger them and hope nothing breaks in between.
>
> The **testing matrix** is enormous. Multiple iOS versions (we support back to iOS 14), multiple Android versions (API level 26 and up), different screen sizes, different accessibility settings. We prioritize testing on the most common configurations, but edge cases slip through."

---

### Question 3: Accessibility Implementation

**"How does accessibility compliance shape your engineering work?"**

> "Section 508 is non-negotiable, which I actually appreciate. It forces us to build accessibility in from the start rather than bolting it on later.
>
> That said, **accessibility is expensive**. Not in a bad way, but it requires significant engineering time. Every UI element needs proper labels. Every interaction needs screen reader announcements. Every custom component needs focus management. We estimate accessibility adds 20-30% to feature development time.
>
> The challenge is that **accessibility is invisible to most stakeholders**. When product asks why a feature is taking longer, explaining that we're implementing proper VoiceOver support doesn't always resonate. They can't see it in the demo.
>
> We've had pushback on timelines when the extra time is 'just for accessibility.' I have to advocate constantly that it's not optional and that cutting corners creates legal risk.
>
> **Testing is also harder** for accessibility. Automated tests catch some issues—missing labels, contrast ratios. But real accessibility testing requires manual verification with actual assistive technology. We do it, but it's time-consuming."

---

## Section 2: Performance and Infrastructure

### Question 1: Performance Optimization

**"What have you tried to improve app performance?"**

> "We've thrown everything at it. On the **network layer**, we have request caching, response compression, and connection pooling. We prefetch data we predict users will need. We batch API calls where possible.
>
> On the **client side**, we've optimized rendering, reduced memory footprint, implemented lazy loading for images and data. We use background refresh to update cached data when the app isn't in use.
>
> **Offline capability** is limited. The backend architecture doesn't support true offline sync. We cache read-only data—appointment history, prescription list—but anything requiring a write operation needs connectivity. We've designed graceful degradation, but 'the app works offline' is not something we can promise.
>
> The biggest wins have come from **perceived performance** improvements rather than actual speed. Skeleton screens, instant feedback on user actions, progress indicators that feel responsive. We can't make the backend faster, but we can make the wait feel less frustrating."

**Follow-up: "What would you need to meaningfully improve actual performance?"**

> "**Backend investment**. The APIs need to be redesigned for mobile use cases. That means faster response times, better pagination, more granular data endpoints. Right now we often fetch more data than we need because that's how the API is structured.
>
> **Edge caching** would help significantly. If we could cache API responses at a CDN level for common queries, we'd cut latency dramatically. But that requires infrastructure changes that are outside our control.
>
> **GraphQL or similar** would let us request exactly the data we need instead of the fixed payloads the REST APIs provide. But that's a major architectural change that would affect multiple teams.
>
> These are all 'big asks' that require coordination across VA. My team can optimize the mobile app all we want, but we've hit the ceiling of what client-side improvements can achieve."

---

### Question 2: Technical Debt

**"How does technical debt affect your team's ability to deliver?"**

> "The app launched in 2021 under pandemic pressure. We made compromises to ship. Some of those compromises are now **load-bearing technical debt**.
>
> Our **state management** is inconsistent. Different features were built by different teams at different times using different patterns. We've been incrementally migrating to a unified architecture, but it's slow work that competes with feature development.
>
> **Dependency management** is a constant tax. Third-party libraries need updates, deprecated APIs need migration, iOS and Android platform changes require adaptation. We spend about 20% of our capacity just keeping the app running on current OS versions.
>
> The **testing infrastructure** is better than it was, but still not where it should be. We have unit tests and integration tests, but end-to-end testing is manual and time-consuming. We've invested in automation, but there's always more to do.
>
> Product sees features shipping; they don't see the maintenance work that enables those features to ship. It's a constant tension between 'build new things' and 'stabilize existing things.'"

---

## Section 3: Team and Process Constraints

### Question 1: Team Capacity

**"What resource constraints affect your team's ability to deliver?"**

> "**We're understaffed** relative to our scope. Twelve engineers supporting two platforms, multiple feature areas, and an app used by millions of veterans. For context, a comparably complex consumer app would have 3-4x the engineering headcount.
>
> **Recruiting is hard**. Federal hiring processes are slow and constrained. By the time we get approval to fill a position, source candidates, and complete the hiring process, 6 months have passed. Good engineers get other offers faster.
>
> **Contractor vs. federal balance** is tricky. We rely on contractors to fill gaps, but they have different incentive structures and less institutional knowledge. Onboarding is expensive. When contracts end or shift, we lose people who understood the system.
>
> **Specialization** is limited. We need people who are strong in iOS and accessibility, or Android and performance optimization. Finding that combination is rare. So we have generalists who learn on the job, which is fine but slower."

---

### Question 2: Cross-Team Coordination

**"How do you work with other teams like design and product?"**

> "**With design**, collaboration is generally good. Jasmine and I work closely. The challenge is timing. Sometimes designs arrive that assume capabilities we don't have, and we're scrambling to communicate constraints.
>
> I've pushed for **earlier engineering involvement** in design. Before a design is finalized, I want to review it for technical feasibility. We've gotten better at this, but it's not consistent. When timelines are tight, design and engineering work in parallel and hope they meet in the middle.
>
> **With product**, the tension is between ambition and capacity. Product sees competitor apps with slick features and wants parity. But those apps have 10x our resources and don't have our backend constraints. I spend a lot of time explaining why 'just add this feature' isn't simple.
>
> **With backend teams**, coordination is the hardest. They're not part of our organization. We request API changes through tickets, wait for prioritization, wait for development, wait for deployment. A simple API enhancement might take 6 months to reach production. So we design around limitations rather than waiting for fixes."

---

## Section 4: Connecting to User Research

**"Users report the app feels 'slow.' From your engineering perspective, what's driving that?"**

> "Backend latency is 80% of it. The other 20% is areas where we haven't fully optimized client-side rendering.
>
> The **claims and appeals** section is the slowest because it aggregates data from the most systems. We're talking to 4-5 different VBA services to compose that view. Each service adds latency.
>
> **Health records** are slow because the data payloads are large. A veteran with decades of VA care has megabytes of records. We've implemented pagination, but the initial load is still heavy.
>
> **Appointments** are actually pretty fast—that's one of our better-performing areas because the scheduling API is more modern.
>
> We've **instrumented everything**. I can tell you exactly which API calls take longest, where the bottlenecks are. The frustrating part is that most of the bottlenecks are in systems we don't control. I can report the issues, but I can't fix them."

---

**"Users report confusion about navigation. What's the engineering perspective on why the navigation works the way it does?"**

> "The navigation structure was designed in 2021 based on what was technically feasible at the time. Some of that was based on **API organization**—we grouped features based on how the backend served data, not necessarily how users think about tasks.
>
> We've talked about restructuring navigation, but it's a **major undertaking**. The navigation isn't just UI—it's tied to our deep linking, analytics tracking, state management, and caching strategies. Changing the surface means changing the plumbing.
>
> There's also **feature flag complexity**. Different users see different features based on their eligibility, enrollment status, and A/B testing. The navigation has to accommodate all those variations. That adds constraints on how we can reorganize.
>
> Design has proposed navigation improvements. Engineering has said 'this is a multi-sprint effort.' Product has to decide if the investment is worth it given other priorities."

---

**"Users struggle with accessibility, particularly unlabeled buttons. What's causing that?"**

> "This one frustrates me because it's **preventable**.
>
> Some unlabeled elements are legacy code from before we had strong accessibility processes. Fixing them is on our backlog, but competes with feature work.
>
> Some are **third-party components** where we have less control. The identity verification flow, for example, uses components from ID.me that we can't modify. We've filed issues, but we're dependent on them to fix.
>
> Some are **regression bugs**. A feature was accessible, something changed, and accessibility broke. Our automated tests catch some of these, but not all. Manual accessibility testing isn't as frequent as it should be because it's time-consuming.
>
> We've made it a team priority to **zero out accessibility bugs** in the next quarter. But that means deprioritizing other work, and product has to agree to that trade-off."

---

## Closing

**"What constraint or challenge haven't I asked about that significantly impacts your engineering work?"**

> "**Security requirements** add friction that users don't see. Every API call is authenticated. Every piece of data is encrypted. Every session has timeout requirements. These are essential for protecting veteran data, but they add complexity and contribute to the 'slow' feel.
>
> The **approval process** for app releases is rigorous. Security review, privacy review, accessibility certification. Each adds time. When we need to ship a quick fix, 'quick' means weeks, not days.
>
> **Observability and debugging** are challenging. When something goes wrong in production, tracing the issue across mobile client, API gateway, and multiple backend services is complex. We've invested in logging and monitoring, but the distributed nature of the system makes root cause analysis hard."

---

**"Who else should I talk to to better understand engineering constraints?"**

> "**Marcus Johnson** manages our backend integration—he's the one who deals with VBA and VHA APIs directly. He can explain the specific limitations of each system.
>
> **Priya Sharma** leads our accessibility engineering. She's the expert on why certain accessibility patterns are hard to implement and what would make them easier.
>
> **DevOps team**—they can explain the infrastructure constraints, deployment pipelines, and why certain performance optimizations require changes we can't make locally.
>
> And honestly, **the API documentation** (or lack thereof). Some of our constraints are because the backend APIs are poorly documented. We've had to reverse-engineer behavior through trial and error. Seeing that firsthand would be illuminating."

---

**"Can I follow up if I have questions?"**

> "Absolutely. tomas.rivera@va.gov or @trivera on Slack.
>
> If your research finds technical issues—things that are broken or confusing—specific details help. 'The claim status is slow' is useful. 'The claim status takes 12 seconds on first load after login' is actionable. I can take that to the performance dashboard, identify the specific API calls, and build a case for backend improvements."

---

## Post-Interview Notes

### Key Constraints Identified

1. **API Latency**: Backend systems designed for desktop/batch processing; mobile gets 8-12 second responses
2. **Two Native Codebases**: Every feature built twice for iOS and Android; 20-30% overhead for accessibility
3. **Backend Dependency**: Can't fix slow APIs; request API changes through tickets that take months
4. **12 Engineers for Millions of Users**: Understaffed relative to scope; recruiting challenges
5. **Technical Debt from 2021 Launch**: Inconsistent patterns, maintenance tax ~20% of capacity
6. **Approval Process**: Security, privacy, accessibility reviews add weeks to release cycles

### Surprising Insights

- Third-party identity verification components (ID.me) have accessibility issues VA can't fix directly
- Navigation structure was based on API organization, not user mental models
- "Just add a feature" from Product doesn't account for backend API constraints
- Feature flags create navigation complexity—different users see different structures
- Automated accessibility tests catch some issues, but manual testing is time-constrained

### Connections to User Research

| User Finding | Engineering Context |
|--------------|---------------------|
| App feels slow | 80% backend latency; client optimizations hit ceiling |
| Unlabeled buttons | Legacy code + third-party components + regression bugs |
| Navigation confusion | Structure based on API organization, not user mental models |
| Inconsistent experience | Feature flags, platform differences, phased rollouts |

### Follow-up Questions

1. Can we get API response time data for the specific flows users find slowest?
2. What would it take to prioritize fixing the known accessibility bugs?
3. Is there a roadmap for backend API improvements that would help mobile?
4. How often does manual accessibility testing happen currently?

### Recommended Additional Interviews

| Name | Role | Focus Area |
|------|------|------------|
| Marcus Johnson | Backend Integration | Specific VBA/VHA API limitations |
| Priya Sharma | Accessibility Engineering | Why certain a11y patterns are hard |
| DevOps Lead | Infrastructure | Deployment constraints, performance infrastructure |

---

*Interview documented by Research Team*
*Qori-generated guide used - January 27, 2026*
