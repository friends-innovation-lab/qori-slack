# 🏛️ Stakeholder Synthesis: VA Health and Benefits Mobile App

> **Generated:** January 26, 2026 | **3 stakeholders** | **Design, Engineering, Legal/Policy teams**

---

## Overview

| | |
|---|---|
| **Stakeholders Interviewed** | 3 (Design Lead, Engineering Lead, Policy SME) |
| **Teams Represented** | Design, Engineering, Legal/Policy, Mobile Platform |
| **Key Constraint** | Mobile API Gateway bottleneck (6-month backlog) + 40% authentication abandonment |
| **Key Insight** | Veterans experience 8-12 second backend delays as "app slowness" while mobile code executes in milliseconds |
| **Critical Gap** | 12 engineers supporting 2.3M users vs. typical tech company ratio of 50-100 engineers for similar complexity |

---

## Stakeholders Interviewed

| Role | Team | Tenure | Focus Areas |
|------|------|--------|-------------|
| Jasmine Oyelaran, Design Lead | VA Mobile Experience Team | 3 years at VA | Mobile UX, accessibility, design system, veteran experience flows |
| Tomás Reyes, Engineering Lead | VA Mobile Platform Team | 5 years at VA | iOS/Android development, API integration, technical architecture |
| Evelyn Tran, Senior Privacy Counsel | VA Office of General Counsel | 8 years at VA | Privacy compliance, HIPAA/Privacy Act, mobile data governance |

---

## 🚧 Constraints & Blockers

### Technical Constraints

> "The fundamental constraint is that we're building a modern mobile experience on top of backend systems designed for desktop web applications—or worse, green-screen terminals from the 1980s." — Engineering Lead

> "I can design the most beautiful, intuitive interface in the world, but if the data takes 10 seconds to load, the design fails. Loading states, error states, empty states—these aren't edge cases for us, they're primary states." — Design Lead

| Constraint | Impact | Downstream Effect | Source(s) |
|------------|--------|-------------------|-----------|
| Mobile API Gateway bottleneck (6-month backlog) | Every feature requires gateway changes; shared team across VA products | Features delayed 4+ months waiting for endpoints | Engineering Lead |
| Backend response times (8-12 seconds for claims) | Veterans experience constant loading spinners | "App feels slow" complaints; 42% onboarding abandonment | Engineering Lead, Design Lead |
| Device fragmentation (iOS 14+, Android 10+) | Must support 6-year-old phones with limited memory | Features killed for crashing older devices | Engineering Lead |
| VistA/VBA legacy systems integration | APIs designed for internal use, not consumer mobile | Cryptic field names, excessive data, poor mobile optimization | Engineering Lead |
| Offline capability limitations | Backend architecture doesn't support mobile offline patterns | Generic "check connection" errors in VA facilities with WiFi | Engineering Lead, Design Lead |

### Policy Constraints

> "VA policy requires session timeout after 30 minutes of inactivity for PHI access. I understand the security rationale, but mobile usage patterns are bursty—veterans open the app, check something, put it down, come back later." — Design Lead

> "The authentication requirements come from multiple sources, all pointing in the same direction: high assurance. For accessing health records (PHI), we need IAL2—identity proofing that verifies the person is who they claim to be." — Policy SME

| Constraint | Impact | User Experience Effect | Source(s) |
|------------|--------|------------------------|-----------|
| IAL2 Identity Assurance (NIST 800-63) | Requires government ID verification, selfie, sometimes video call | 40% of veterans abandon initial setup; delete app | Engineering Lead, Policy SME |
| 30-minute session timeout | Automatic logout disrupts mobile usage patterns | Veterans re-authenticate frequently; forms lose progress | Design Lead, Policy SME |
| No PHI in notifications | Lock screen privacy protection | All notifications vague: "You have a new message" vs. useful previews | Design Lead, Policy SME |
| Privacy Act + HIPAA dual compliance | Can't collect behavioral analytics like commercial apps | Limited ability to diagnose individual user problems | Design Lead, Policy SME |
| No family/caregiver sharing | Individual authentication required; delegation framework years away | Most-requested feature can't be implemented | Engineering Lead, Policy SME |

### Resource Constraints

> "We're six designers supporting an app used by over 2 million veterans. For context, a typical tech company would have that many designers for a single feature area." — Design Lead

| Constraint | Impact | Systemic Effect | Source(s) |
|------------|--------|-----------------|-----------|
| 6 designers for 2M+ users | No time for proper discovery → testing → iteration | Assumptions-based design; issues found post-launch | Design Lead |
| 12 engineers for 2.3M users | Understaffed vs. typical tech company (50-100 engineers) | Features delayed; 4-6 month hiring backfill | Engineering Lead |
| 2-8 week privacy review process | Thorough but time-consuming legal review | Teams must engage legal 6+ months before launch | Policy SME |
| Shared research capacity | Research partners serve VA.gov + mobile + other properties | 4-6 week wait for usability testing; often ship before testing | Design Lead |
| Federal hiring process | Security clearance + bureaucracy delays | Lost candidates to private sector mid-process | Engineering Lead |

---

## 🎯 Strategic Priorities

> "The honest truth is that 'serving users' and 'serving leadership visibility' aren't always aligned. A feature that affects 100,000 veterans daily might get deprioritized for a feature that will be in a press release, even if that feature affects 5,000 veterans." — Engineering Lead

| Priority | Driver | Timeline | Aligns With User Needs? | Source |
|----------|--------|----------|:-----------------------:|--------|
| Security patches, accessibility remediation | Mandatory compliance | Immediate | ✅ | Engineering Lead |
| Leadership visibility features | VA Secretary speeches, Congressional mentions | Urgent when triggered | ⚠️ | Engineering Lead |
| User-demanded features | Support tickets, app store reviews, research | Third priority | ✅ | Engineering Lead |
| Technical debt reduction | App stability, maintainability | Rarely prioritized | ✅ | Engineering Lead |
| VHA vs VBA feature competition | Separate administrations with separate priorities | Ongoing tension | ⚠️ | Design Lead, Engineering Lead |

**Critical Alignment Gap:** Press release features can override daily-use improvements affecting 100K+ veterans

---

## ⚙️ Backstage Processes

### Authentication & Identity Verification Flow

> "Veterans download the app expecting to check their claim status in 30 seconds. Instead, they face: download → account creation → identity proofing (multiple steps) → MFA setup → waiting for verification → finally, access. By the time they see their data, they're exhausted. Some don't make it at all." — Design Lead

> "Our analytics show 40% of veterans who start this process don't complete it. They delete the app and never come back." — Engineering Lead

**Frontend Steps (User-Facing):**
1. App download from store
2. Welcome screens (Design controls only this)
3. Account creation choice (Login.gov or ID.me)
4. Identity proofing: upload driver's license ← **High failure rate here**
5. Selfie verification ← **"Failed three times before it worked"**
6. Sometimes video call verification
7. MFA setup (phone/email)
8. Biometric setup (Face ID/Touch ID)
9. Finally: app access ← **40% drop-off before reaching this**

**Backend Steps (Invisible to User):**
1. ID.me/Login.gov identity verification processing
2. Document authenticity validation
3. Biometric matching algorithms
4. VA Profile account linking
5. Security clearance checks
6. Session establishment with 30-min timeout
7. PHI access authorization

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| Document photo capture | Mobile camera interface not optimized for ID cards | "Driver's license photo thing failed three times" | High - mentioned by Design Lead |
| Identity verification timeout | Process takes too long; veterans give up | "This is taking too long" - #1 abandonment reason | 40% don't complete setup |
| Biometric enrollment failure | Face ID/Touch ID setup issues | Must use full re-authentication every time | Moderate |
| Cross-platform inconsistency | ID.me/Login.gov designed for web, adapted poorly for mobile | Jarring experience transitions | Ongoing issue |

**Systems Involved:** ID.me, Login.gov, VA Profile, Mobile API Gateway, iOS/Android biometric APIs

---

### Claims Status Retrieval Flow

> "The claims status endpoint is particularly bad. It aggregates data from multiple VBA systems, and the aggregation happens synchronously. If one system is slow, everything's slow." — Engineering Lead

> "What the API gives us is: claim type, filing date, status (one of about 8 values), and sometimes a vague 'steps completed' indicator. That's not enough for veterans who want to understand why their claim is taking six months." — Design Lead

**Frontend Steps (User-Facing):**
1. Veteran taps "Claims" in app
2. Loading spinner appears ← **Veterans see this for 8-12 seconds**
3. Claims list displays (limited data)
4. Tap individual claim for details
5. More loading ← **Another 8-12 second wait**
6. Basic status information shown

**Backend Steps (Invisible to User):**
1. Mobile app calls Mobile API Gateway
2. Gateway calls multiple VBA legacy systems synchronously
3. Data aggregation from claims processing systems
4. Status translation from internal jargon
5. Response formatting for mobile consumption
6. Data returned through gateway to app

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| VBA system synchronous calls | One slow system delays entire response | 8-12 second loading times; "app feels frozen" | Daily occurrence |
| Limited API data availability | Backend doesn't expose detailed claim information | Veterans can't see "why it's taking so long" | Systemic limitation |
| Status terminology changes | VBA changes internal terms without notice | Plain-language translations break | Periodic disruption |
| Timeout failures | Backend takes too long; mobile app gives up | "Unable to load data" errors | Regular occurrence |

**Systems Involved:** Mobile API Gateway, VBA Claims Processing System, VBA Benefits API, multiple legacy databases

---

### Feature Development Approval Process

> "Total timeline for 'just show lab results': 6-9 months. The actual engineering work is maybe 15% of that time." — Engineering Lead

> "My review typically takes 2-3 weeks for straightforward features, 6-8 weeks for complex ones involving new data types or sharing arrangements." — Policy SME

**Frontend Steps (User-Facing):**
1. Feature appears in app update
2. Veterans use new functionality

**Backend Steps (Invisible to User):**
1. Product Review Board (monthly meeting, can queue for months)
2. API Discovery (does mobile-friendly endpoint exist?)
3. Backend API creation/modification (Health API team backlog)
4. Mobile Gateway integration (6-month backlog)
5. Security Review (Information Security assessment)
6. Privacy Impact Assessment (6-8 weeks if new data types)
7. 508 Accessibility Review (screen reader testing)
8. ATO Boundary Check (3-6 months if security boundary changes)
9. Engineering implementation (2-3 sprints)
10. Staged rollout (1% → full over 3-4 weeks)
11. App Store Review (1-3 days, can reject unexpectedly)

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| Mobile API Gateway capacity | Shared team, 6-month backlog | Features delayed 4+ months waiting for endpoints | Every new feature |
| Security assessment cycles | Back-and-forth questions extend review | 2-week review becomes 6 weeks | Common |
| Backend team dependencies | Health/Benefits API teams have own priorities | Mobile features wait for backend capacity | Systemic |
| App store policy changes | Apple/Google rules change without warning | Features removed (background location killed) | Unpredictable |

**Systems Involved:** Product Review Board,
