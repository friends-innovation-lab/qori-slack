# 🏛️ Stakeholder Synthesis: VA Health and Benefits Mobile App

> **Generated:** January 2026 | **3 stakeholders** | **Policy, Design, Engineering**

---

## Overview

| | |
|---|---|
| **Stakeholders Interviewed** | 3 |
| **Teams Represented** | Policy & Compliance, Design, Engineering |
| **Key Constraint** | Backend API latency (8-12 seconds average) creating loading-dominant experience |
| **Key Insight** | Mobile app constrained by systems designed for desktop/batch processing, not mobile patterns |
| **Critical Gap** | 12 engineers supporting 2M+ veterans across two platforms with 20% capacity consumed by maintenance |

---

## Stakeholders Interviewed

| Role | Team | Tenure | Focus Areas |
|------|------|--------|-------------|
| Policy SME | VA Office of Information Security & Privacy | 7 years at VA | HIPAA compliance, Section 508, authentication policy, PHI protection |
| Design Lead | VA Mobile Experience Team | 3 years at VA | Mobile UX, accessibility, design system, veteran experience flows |
| Engineering Lead | VA Mobile App Team | 4 years at VA | Mobile architecture, API integration, performance optimization, accessibility implementation |

---

## 🚧 Constraints & Blockers

### Technical Constraints

> "Our claims status API, for example, aggregates data from multiple VBA systems. Each hop adds latency. By the time the response reaches the app, we're looking at 8-12 seconds on average. Some users on poor connections see 20+ seconds." — Engineering Lead

> "Loading states, error states, empty states—these aren't edge cases for us, they're primary states. Veterans spend a significant amount of time looking at spinners and error messages." — Design Lead

| Constraint | Impact | Downstream Effect | Source(s) |
|------------|--------|-------------------|-----------|
| Backend API latency (8-12 seconds average, 20+ seconds on poor connections) | Veterans wait extensively for data | Loading spinners become primary experience state, not edge case | Engineering Lead, Design Lead |
| Two native codebases (iOS/Android) | Every feature built twice with 20-30% accessibility overhead | Platform divergence leads to middle-ground design native to neither | Engineering Lead, Design Lead |
| Backend systems designed for desktop/batch processing | APIs not optimized for mobile data constraints | 500+ prescription records, huge payloads, poor pagination | Engineering Lead |
| 12 engineers for 2M+ veterans across platforms | 20% capacity consumed by maintenance/technical debt | No time for proper discovery → testing → iteration process | Engineering Lead, Design Lead |

### Policy Constraints

> "HIPAA is strict about how PHI can be displayed, transmitted, and stored. On mobile, this creates specific challenges. Lock screen notifications are a classic example... Both contain PHI. The doctor's name reveals the patient-provider relationship. The prescription implies a medical condition." — Policy SME

> "Session timeout policy is the one I fight most. VA policy requires session timeout after 30 minutes of inactivity for PHI access. I understand the security rationale, but mobile usage patterns are bursty—veterans open the app, check something, put it down, come back later." — Design Lead

| Constraint | Impact | User Experience Effect | Source(s) |
|------------|--------|------------------------|-----------|
| PHI lock screen restrictions | Rich notifications expose health information | Notifications limited to "You have a new secure message" instead of useful previews | Policy SME, Design Lead |
| IAL2 identity verification requirement | Federal requirement for PHI access | Document upload, selfie verification, knowledge questions create painful onboarding | Policy SME, Design Lead |
| 30-minute session timeout (HIPAA Security Rule) | Automatic logout after inactivity | Disrupts mobile usage patterns; every form designed around timeout risk | Policy SME, Design Lead |
| Legal consent language requirements | Full terms must be visible, no summaries without approval | Screens of legalese create consent fatigue; veterans scroll past without reading | Policy SME, Design Lead |
| Section 508 accessibility compliance | Non-negotiable WCAG 2.1 AA compliance | 20-30% additional development time; features cannot ship inaccessible | Policy SME, Engineering Lead |

### Resource Constraints

> "We're six designers supporting an app used by over 2 million veterans. For context, a typical tech company would have that many designers for a single feature area." — Design Lead

| Constraint | Impact | Systemic Effect | Source(s) |
|------------|--------|-----------------|-----------|
| 6 designers for 2M+ veterans | Cannot do proper design process (discovery → testing → iteration) | Rapid exploration → stakeholder review → ship; assumptions instead of research | Design Lead |
| 12 engineers, understaffed 3-4x relative to comparable consumer apps | Federal hiring processes take 6 months | Contractor dependency, knowledge loss, generalists learning on job | Engineering Lead |
| Research capacity shared across VA.gov, mobile app, other properties | Getting usability testing takes 4-6 weeks | Ship features based on assumptions; find problems after veteran complaints | Design Lead |
| Inter-agency dependencies (VHA, VBA, ID.me, Login.gov) | API changes require multi-stakeholder coordination | Simple enhancements take 6 months; design around limitations instead of waiting for fixes | Policy SME, Engineering Lead |

---

## 🎯 Strategic Priorities

> "My job is risk mitigation. A privacy breach affecting veterans would be catastrophic—not just legally, but for veteran trust in VA." — Policy SME

> "High-visibility, high-risk features get the most attention. If it's going in a press release, if it affects a critical flow like claims or appointments, if leadership is watching—those get proper design process." — Design Lead

| Priority | Driver | Timeline | Aligns With User Needs? | Source |
|----------|--------|----------|:-----------------------:|--------|
| Privacy/Security Compliance | HIPAA, Section 508, federal requirements | Ongoing/Non-negotiable | ⚠️ | Policy SME |
| Backend API Performance | 8-12 second response times hurting UX | Dependent on VBA/VHA roadmaps | ✅ | Engineering Lead |
| Accessibility Zero-Bug Goal | Section 508 compliance, legal risk | Next quarter | ✅ | Engineering Lead |
| High-Visibility Features | Leadership attention, press releases | Sprint-driven | ❌ | Design Lead |
| Technical Debt Reduction | 2021 launch compromises now constraining | 20% capacity ongoing | ⚠️ | Engineering Lead |
| Identity Verification Optimization | Primary onboarding barrier | Dependent on ID.me/Login.gov | ✅ | Policy SME, Design Lead |

**Critical Alignment Gap:** High-visibility features get design attention over veteran-impacting improvements like error message clarity, empty states, and edge case flows. "The urgent always beats the important" creates a mismatch between what gets resources and what veterans actually struggle with.

---

## ⚙️ Backstage Processes

### Identity Verification & Onboarding

> "IAL2 identity verification is federal policy, not VA choice. This is federal policy, not VA choice. IAL2 means the person's identity has been verified against government records with a high degree of confidence." — Policy SME

> "Onboarding is the accumulation of every constraint at once. Identity verification is policy-mandated. The verification steps are determined by ID.me/Login.gov, not us." — Design Lead

**Frontend Steps (User-Facing):**
1. Download app from app store
2. Tap "Sign in" → redirected to Login.gov or ID.me selection
3. Document upload (driver's license photo) ← **High abandonment point**
4. Selfie verification with positioning requirements ← **"Failed three times before it worked"**
5. Knowledge-based authentication questions
6. Phone number verification via SMS code
7. MFA setup (biometrics or authenticator app)
8. Return to VA app, complete profile setup
9. Accept Terms of Service (lengthy legal text) ← **Consent fatigue**
10. Finally access veteran data

**Backend Steps (Invisible to User):**
1. ID.me/Login.gov performs document OCR and validation
2. Facial recognition matching against selfie
3. Knowledge questions pulled from credit/government databases
4. Identity verification score calculated against IAL2 threshold
5. MFA enrollment stored in identity provider
6. VA receives identity assertion with confidence level
7. VA creates/links veteran profile in internal systems
8. Session token generated with 30-minute timeout policy

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| Document Photo Quality | OCR fails to read license/ID clearly | "Try again" loop with no guidance on what's wrong | High - mobile cameras not optimized for document capture |
| Selfie Matching Failure | Facial recognition rejects photo | Repeated selfie attempts, eventual human review | Medium - lighting/angle sensitive |
| Knowledge Questions Wrong | Credit bureau data doesn't match veteran's answers | Locked out, must call support line | Medium - data accuracy issues |
| SMS Code Delays | Phone verification code doesn't arrive | Stuck in verification loop | Low but frustrating |
| Session Timeout During Process | 30-minute policy kicks in mid-verification | Must restart entire flow | Medium - process often takes >30 minutes |

**Systems Involved:** ID.me identity verification, Login.gov identity verification, VA identity management, VHA/VBA profile systems, SMS gateway, document OCR services

---

### Claims Status Retrieval

> "Our claims status API, for example, aggregates data from multiple VBA systems. Each hop adds latency. By the time the response reaches the app, we're looking at 8-12 seconds on average." — Engineering Lead

> "What the API gives us is: claim type, filing date, status (one of about 8 values), and sometimes a vague 'steps completed' indicator. That's not enough for veterans who want to understand why their claim is taking six months." — Design Lead

**Frontend Steps (User-Facing):**
1. Tap "Claims" from main navigation
2. Loading screen with skeleton cards (8-12 seconds) ← **"This is taking too long" abandonment**
3. Claims list appears with basic status
4. Tap individual claim for details
5. Another loading screen for claim details (5-8 seconds)
6. Limited detail view with status and basic timeline

**Backend Steps (Invisible to User):**
1. Mobile API receives request with veteran identifier
2. Query VBA claims database for basic claim records
3. For each claim, query separate systems for:
   - Current status from workflow engine
   - Evidence tracking from document system
   - Examiner assignments from scheduling system
   - Decision data from rating system
4. Aggregate responses across 4-5 VBA services
5. Transform internal status codes to display values
6. Apply business rules for what data can be exposed
7. Return consolidated response to mobile app

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| Individual Service Timeout | One of 4-5 backend services doesn't respond | Partial data or complete failure | Medium - cascading failure risk |
| Status Code Translation | Internal jargon changes without notice | Broken plain-language translations | Low but confusing |
| Data Staleness | Cached data doesn't reflect recent updates | Veterans see outdated status | Medium - cache vs. freshness tension |
| Pre-Decisional Data Filtering | Policy prevents showing examiner notes/internal workflow | Veterans can't understand "why" behind delays | High - by design but frustrating |
| Pagination Failures | Large claim history overwhelms response | Timeout or partial load | Low but affects long-term veterans |

**Systems Involved:** VA mobile API gateway, VBA claims database, VBA workflow engine, VBA document management, VBA examiner scheduling, VBA rating system, caching layer

---

### Health Data Retrieval & Display

> "Health records are slow because the data payloads are large. A veteran with decades of VA care has megabytes of records. We've implemented pagination, but the initial load is still heavy." — Engineering Lead

> "We cannot log PHI or PII. That limits debugging. When something goes wrong for a veteran, we can't see the specific data involved—we see anonymized patterns." — Policy SME

**Frontend Steps (User-Facing):**
1. Tap "Health" from main navigation
2. Progressive loading: appointments first (2 seconds), then prescriptions (4 seconds), then messages (6 seconds)
3. Tap specific section for details
4. Additional loading for detailed records
5. Limited offline access to cached data

**Backend Steps (Invisible to User):**
1. Authenticate session against 30-minute timeout policy
2. Query VHA scheduling system for upcoming appointments
3. Query VHA pharmacy system for prescription status
4. Query VHA messaging system for secure messages
5. Query VHA medical records for recent visits/results
6. Apply PHI filtering rules for mobile display
7. Encrypt all data in transit and at rest
8. Cache approved data with expiration timers

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| Session Timeout Mid-Load | 30-minute policy expires during data fetch | Sudden logout, must re-authenticate | Medium - mobile usage patterns don't fit timeout |
| PHI Display Restrictions | Can't show doctor names in notifications | Generic "You have a message" alerts | High - by design but less useful |
| Large Data Payloads | Decades of records overwhelm mobile connection | Very slow loading, potential timeouts | Medium - affects long-term patients |
| Cache Expiration | Security policy clears cached health data | Must reload previously viewed information | High - intentional but creates friction |
| Cross-System Data Inconsistency | VHA systems don't sync perfectly | Appointment in one place, not another | Low but confusing |

**Systems Involved:** VHA scheduling (VISTA), VHA pharmacy system, VHA secure messaging, VHA medical records, VA mobile API, encryption services, caching layer with expiration policies

---

### Session Management & Authentication

> "Session timeout after inactivity is a standard safeguard. If a veteran leaves their phone unattended while logged into the app, an automatic timeout reduces the window of exposure." — Policy SME

> "The authentication layer is complex. We support Login.gov and ID.me, each with their own token management. Refresh flows, session extension, biometric re-authentication—there's a lot of state to manage." — Engineering Lead

**Frontend Steps (User-Facing):**
1. Biometric prompt (Face ID/Touch ID) for quick access
2. If biometric fails: full credential entry required
3. Session active for 30 minutes of inactivity
4. Warning at 25 minutes: "Session expiring soon"
5. Automatic logout at 30 minutes
6. All cached PHI cleared from device

**Backend Steps (Invisible to User):**
1. Biometric verification handled by iOS/Android (VA never sees biometric data)
2. Session token validated against identity provider
3. Token refresh attempted if near expiration
4. Activity tracking for 30-minute countdown
5. Session invalidation triggers across all VA systems
6. Audit logging of authentication events (no PHI logged)

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| Biometric Re-auth Failure | Face ID/Touch ID doesn't work | Must enter full credentials again | Medium - lighting, position, device issues |
| Token Refresh Failure | Backend can't extend session | Unexpected logout mid-task | Medium - network connectivity issues |
| Cross-System Session Sync | Different VA systems have different timeout policies | Inconsistent logout behavior | Low but confusing |
| Activity Detection Bugs | App doesn't register user activity properly | Premature timeout while actively using | Low but very frustrating |
| Cached Data Persistence | PHI not properly cleared on logout | Security incident, policy violation | Very Low but high severity |

**Systems Involved:** iOS/Android biometric APIs, Login.gov/ID.me token services, VA session management, audit logging system, device secure storage

---

### Notification Delivery & PHI Protection

> "Lock screen notifications are a classic example. The team wanted rich notifications—'Dr. Smith confirmed your Tuesday appointment' or 'Your prescription is ready for pickup.' Both contain PHI." — Policy SME

> "Platform divergence is a constant tension. iOS and Android handle push notifications very differently—what you can show, how users interact with them, where they surface." — Design Lead

**Frontend Steps (User-Facing):**
1. Generic notification appears on lock screen: "You have a new secure message"
2. User unlocks device and opens app
3. Must authenticate (biometric or full login)
4. Navigate to specific section to see actual content
5. Detailed information only visible within authenticated app

**Backend Steps (Invisible to User):**
1. VHA/VBA system generates event (appointment confirmed, message received)
2. Event processed through notification service
3. PHI filtering applied - remove doctor names, specific details
4. Generic message template selected
5. Push notification sent via Apple/Google services
6. Detailed content stored in app for authenticated access only

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| PHI Accidentally Exposed | Rich notification shows protected information | Privacy violation, potential legal issue | Very Low but catastrophic |
| Notification Delivery Failure | Push service doesn't deliver message | Veterans miss important updates | Medium - network/device dependent |
| Platform Differences | iOS vs Android notification behavior differs | Inconsistent experience across devices | High - by design but confusing |
| Generic Message Fatigue | All notifications say same thing | Veterans ignore notifications as not useful | High - policy-driven

---

## 🎯 Service Blueprint Implications

> Key inputs for backstage/support layer mapping

### Frontstage Moments That Depend on Fragile Backstage

| Frontstage Moment | Backstage Dependency | Failure Mode |
|-------------------|----------------------|--------------|
| Veteran opens app to check claim status | Claims API aggregates data from 4-5 VBA systems (8-12 sec response) | Extended loading states, timeouts, veterans abandon task |
| Veteran receives notification about appointment | PHI filtering layer strips identifying details to comply with HIPAA | Generic notifications ("You have a message") provide no actionable context |
| Veteran completes identity verification | ID.me/Login.gov systems not optimized for mobile; document capture fails frequently | Multiple retry attempts, abandonment during onboarding |
| Veteran session times out after 30 minutes | HIPAA-mandated security policy; no flexibility at app level | Mid-task interruption, form data loss, re-authentication friction |
| Veteran tries to access detailed claim information | API only provides 8 status values and basic fields; examiner notes/timelines not exposed | "Why is this taking 6 months?" questions can't be answered |

### Support Processes Currently Manual

| Process | Current State | Risk |
|---------|---------------|------|
| Accessibility bug remediation | Manual testing quarterly; fixes compete with feature work for engineering capacity | Known accessibility issues persist for months; Section 508 compliance gaps |
| API performance monitoring | Engineering tracks response times but can't fix backend; reports issues to other teams | Performance problems identified but not resolved; user frustration continues |
| Policy interpretation for new features | Each feature reviewed by Policy SME; no self-service guidance for teams | Feature development blocked waiting for policy review; inconsistent interpretations |
| Cross-platform testing | Manual verification on multiple iOS/Android versions; edge cases slip through | Platform-specific bugs reach production; inconsistent user experience |
| Consent language updates | Legal team must approve all changes; no plain language alternatives allowed | User-hostile consent screens persist; "consent fatigue" acknowledged but not addressed |

### Line of Visibility Gaps

| Users See | Users Don't See | Creates Confusion When... |
|-----------|-----------------|---------------------------|
| "Loading..." spinner for 12 seconds | Claims API querying 5 different VBA systems sequentially | Veterans think app is broken, not that backend is slow |
| Generic notification: "You have a secure message" | PHI protection policy prevents showing doctor name or message preview | Veterans can't prioritize which messages are urgent |
| Session timeout after 30 minutes | HIPAA Security Rule mandates timeout; no app-level control | Veterans blame app for "logging them out randomly" |
| Identity verification fails repeatedly | ID.me camera capture not optimized for mobile; lighting/positioning issues | Veterans think they're "doing it wrong" rather than technical limitation |
| Navigation based on backend API structure | Features grouped by data source, not user mental models | Veterans can't find related tasks that are organizationally separated |

---

## 🔍 Questions for User Research

> Based on stakeholder input, explore these with participants

### High Priority (🔴)

| Stakeholder Insight | Research Question | Method |
|---------------------|-------------------|--------|
| Policy: Veterans may want user-controlled privacy settings for richer notifications | Would veterans opt into showing doctor names/appointment details on lock screen if they understood privacy risks? How do they think about this trade-off? | Interview + concept testing |
| Design: Onboarding abandonment driven by "taking too long" not "too hard" | At what point in identity verification do veterans abandon? What would make them persist through longer flows? | Usability testing + analytics review |
| Engineering: 80% of "slow" perception is backend latency veterans can't see | How do veterans interpret long loading times? Do they understand difference between app problems vs. system problems? | Interview + think-aloud during slow tasks |
| Policy: "Consent fatigue" acknowledged but legal won't approve shorter versions | Do veterans actually read consent screens? What information do they want vs. what they skip? | Eye tracking + interview |
| Design: Claims status terminology changes without notice, breaking translations | When claim status uses jargon, how do veterans interpret it? What do they do when confused? | Interview + card sorting |

### Medium Priority (🟡)

| Stakeholder Insight | Research Question | Method |
|---------------------|-------------------|--------|
| Engineering: Navigation structure based on API organization, not user mental models | How do veterans expect to find related tasks? What would ideal information architecture look like? | Tree testing + mental model interviews |
| Design: Cross-platform compromises feel native to neither iOS nor Android | Do veterans notice platform inconsistencies? Do they expect native patterns? | Comparative usability testing |
| Policy: Some veterans appreciate privacy protections, others find them frustrating | What drives different privacy preferences among veterans? How do they think about convenience vs. protection? | Interview + segmentation analysis |
| Engineering: Accessibility bugs are "preventable" but compete with feature work | Which accessibility issues most impact veterans with disabilities? What's the severity hierarchy? | Assistive technology testing |
| Design: "Design negotiation" between ideal experience and technical constraints | When features ship in "diminished form," do veterans notice? What's the impact? | Before/after concept testing |

### Validation Questions (🟢)

| Stakeholder Assumption | Validate With Users |
|------------------------|---------------------|
| Policy: "Military culture includes reluctance to share health struggles" drives privacy preference | Do veterans actually prefer private notifications, or would they choose convenience? |
| Design: Veterans expect mobile apps to be "fast and simple" like consumer apps | What are veterans' actual expectations for government app performance vs. commercial apps? |
| Engineering: Skeleton screens and progressive loading make waiting "feel less frustrating" | Do current loading state designs actually improve perceived performance? |
| Policy: Veterans would accept longer onboarding if they understood it "protects them from identity theft" | Does security messaging reframe identity verification as protection rather than friction? |
| Design: Veterans with "only health needs see benefits stuff cluttering their experience" | Do veterans want personalized home screens, or do they value seeing all available services? |

---

## ❓ Open Questions

> Questions that couldn't be answered — need follow-up interviews or data

### Immediate Follow-Up Needed (🔴)

| Question | Who Might Know | Why It Matters |
|----------|----------------|----------------|
| What would a user-controlled privacy settings proposal need to include to get legal approval? | Office of General Counsel | Could enable richer notifications while maintaining privacy choice |
| How often does manual accessibility testing actually happen vs. should happen? | Priya Sharma (Accessibility Engineering) | Gap between stated priority and actual practice affects veteran experience |
| What's the specific timeline for backend API improvements that would help mobile performance? | Marcus Johnson (Backend Integration) | Engineering hitting ceiling of client-side optimizations |
| Can we quantify the actual cost/timeline for navigation restructuring? | Engineering + Design teams | Major UX improvement blocked by unclear implementation scope |

### Needs Policy/Legal Clarification (🟡)

| Question | Who Might Know | Why It Matters |
|----------|----------------|----------------|
| What evidence would support extending session timeout from 30 to 45+ minutes for mobile? | Policy SME + Security team | Core mobile UX friction with potential policy solution |
| Is there appetite for user research specifically on consent experience to inform legal discussions? | Office of General Counsel | Could provide evidence for consent flow improvements |
| What's the process for proposing mobile-specific guidance in upcoming policy reviews? | Dr. Rebecca Okonkwo (Policy SME) | Many constraints stem from desktop-era policies |
| How do we measure "informed consent" for privacy settings in a legally defensible way? | Office of General Counsel + Policy | Blocks user-controlled privacy features |

### Requires Cross-Team Coordination (🟡)

| Question | Teams Involved | Why It Matters |
|----------|----------------|----------------|
| What would credential federation across agencies actually look like for veterans? | ID.me/Login.gov + VA Policy | Could reduce onboarding friction significantly |
| How do we prioritize mobile-specific improvements in the VA.gov Design System? | VADS team + Mobile team | Current system built web-first, mobile afterthought |
| What's the governance model for API changes that would benefit mobile but require VHA/VBA coordination? | Product + Backend + VHA/VBA | Most performance improvements blocked by API limitations |

---

## 📋 Recommendations

### Immediate Actions (🔴 High Priority)

| Action | Constraint Addressed | Feasibility | Owner |
|--------|---------------------|-------------|-------|
| Document and prioritize known accessibility bugs for Q1 sprint allocation | Unlabeled buttons, regression bugs | ✅ | Engineering Lead |
| Create "aspirational design" showcase for API improvement advocacy | Limited claims data availability | ✅ | Design + Product |
| Implement consistent error messaging for authentication timeouts | Unpredictable session expiration | ✅ | Engineering + Content |
| Establish weekly engineering-design feasibility check-ins | Late-stage technical constraint discovery | ✅ | Design + Engineering Leads |

### Near-Term Actions (🟡 Medium Priority)

| Action | Constraint Addressed | Feasibility | Owner |
|--------|---------------------|-------------|-------|
| Pilot user research on consent experience with legal team | Consent fatigue, legal language requirements | ⚠️ | Research + Policy SME |
| Create mobile-specific component proposal process for VADS | Design system gaps, slow component approval | ⚠️ | Design + VADS team |
| Develop session timeout user research to support policy change proposal | 30-minute timeout disrupting mobile patterns | ⚠️ | Research + Policy |
| Establish SLA expectations with backend API teams | Unclear timelines for API improvements | ⚠️ | Product + Backend Integration |

### Strategic Actions (🟢 Long-Term)

| Action | Constraint Addressed | Feasibility | Owner |
|--------|---------------------|-------------|-------|
| Advocate for mobile-first API design standards across VA | Backend systems designed for desktop/batch | ❌ | Product + Leadership |
| Propose navigation restructuring with phased implementation plan | Navigation based on API structure, not user mental models | ⚠️ | Design + Engineering + Product |
| Build case for dedicated mobile policy guidance within existing regulations | Desktop-era policies constraining mobile UX | ❌ | Policy + Leadership |
| Establish veteran advisory panel for ongoing UX feedback | Limited user research capacity | ⚠️ | Research + Product |

---

## 📚 Methodology

**Framework:** Stakeholder Research Synthesis for Service Design

**Approach:** Aggregated findings from 3 internal stakeholder interviews (Policy SME, Design Lead, Engineering Lead), organized by constraint type, priority alignment, and backstage process mapping. Cross-referenced insights across technical, design, and policy perspectives to identify systemic patterns and root causes.

**Key Synthesis Methods:**
- Constraint triangulation (same issue from technical, design, and policy angles)
- Process mapping with failure mode identification  
- Priority alignment analysis (stated priorities vs. user needs)
- Open question documentation for follow-up

**Data Sources:**
- Dr. Rebecca Okonkwo, Policy & Compliance SME (55 minutes)
- Jasmine Oyelaran, Design Lead (49 minutes)
- Tomás Rivera, Engineering Lead (52 minutes)

---

## 👥 Recommended Next Interviews

| Name/Role | Team | Focus Area | Priority |
|-----------|------|------------|----------|
| Office of General Counsel | Legal | Consent language approval, liability concerns, user-controlled privacy settings | 🔴 |
| Marcus Johnson | Backend Integration | Specific VBA/VHA API limitations, improvement timelines | 🔴 |
| Priya Sharma | Accessibility Engineering | Implementation challenges, testing frequency, bug prioritization | 🔴 |
| Ryan Chen | Content Design | Language constraints, legal terminology, plain language tensions | 🟡 |
| VBA Privacy Officer | Benefits Data Governance | Claims data exposure limits, inter-agency coordination | 🟡 |
| Alicia Torres | VA.gov Design System | Mobile pattern gaps, component approval process | 🟡 |
| 508 Compliance Office | Accessibility Review | Review process, escalation triggers, timeline requirements | 🟡 |
| ID.me/Login.gov Product Teams | Identity Verification | Mobile optimization roadmap, constraint explanations | 🟡 |
| Dr. Keisha Williams | Center for Innovation | Cognitive accessibility research, implementation gaps | 🟢 |
| Beta Program Veterans | User Community | Longitudinal perspective on app changes, detailed feedback patterns | 🟢 |

---

<details>
<summary>References</summary>

This analysis follows established stakeholder research and service design methods:

- **Steve Portigal** — "Interviewing Users" (stakeholder interview techniques)
- **Kim Goodwin** — "Designing for the Digital Age" (stakeholder alignment)
- **Stickdorn & Schneider** — "This Is Service Design Thinking" (backstage process mapping)
- **Kalbach** — "Mapping Experiences" (service blueprint methodology)

</details>

---

*Generated by Qori • January 2026*
