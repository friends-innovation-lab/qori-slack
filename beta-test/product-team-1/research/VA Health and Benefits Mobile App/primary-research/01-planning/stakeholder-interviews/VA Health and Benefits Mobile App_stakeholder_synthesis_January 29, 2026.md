# 🏛️ Stakeholder Synthesis: VA Health and Benefits Mobile App

> **Generated:** January 26, 2026 | **3 stakeholders** | **Legal, Engineering, Design**

---

## Overview

| | |
|---|---|
| **Stakeholders Interviewed** | 3 (Policy SME, Engineering Lead, Design Lead) |
| **Teams Represented** | VA Office of General Counsel, Mobile Platform Engineering, Mobile Experience Design |
| **Key Constraint** | Mobile API Gateway bottleneck: 6-month backlog delays every feature |
| **Key Insight** | 40% of veterans abandon initial identity proofing setup and never return to app |
| **Critical Gap** | Backend systems designed for 1980s terminals serving 2.3M mobile users |

---

## Stakeholders Interviewed

| Role | Team | Tenure | Focus Areas |
|------|------|--------|-------------|
| Senior Privacy Counsel & Policy SME | VA Office of General Counsel | 8 years at VA, 16 years federal privacy law | HIPAA/Privacy Act compliance, mobile authentication policy, data governance |
| Engineering Lead | Mobile Platform Team | 5 years at VA, 14 years mobile development | iOS/Android development, API integration, 12-engineer team management |
| Design Lead | Mobile Experience Team | 3 years at VA, 11 years mobile UX | Information architecture, accessibility, design system, 6-designer team |

---

## 🚧 Constraints & Blockers

### Technical Constraints

> "We're building a modern mobile experience on top of backend systems designed for desktop web applications—or worse, green-screen terminals from the 1980s." — Engineering Lead

> "I can design the most beautiful, intuitive interface in the world, but if the data takes 10 seconds to load, the design fails." — Design Lead

| Constraint | Impact | Downstream Effect | Source(s) |
|------------|--------|-------------------|-----------|
| Mobile API Gateway bottleneck | 6-month backlog; every feature requires gateway changes | Veterans wait 6-9 months for "simple" features like lab results | Engineering Lead |
| Backend response times | Claims status takes 8-12 seconds; VBA systems aggregate synchronously | Veterans see loading spinners as primary experience; 40% think app is frozen | Engineering Lead, Design Lead |
| Device fragmentation | Must support 6-year-old phones with 2GB RAM | Features killed for crashing older devices; memory limits constrain data display | Engineering Lead, Design Lead |
| Legacy system integration | VistA (1980s), VBA claims systems not designed for mobile APIs | Data in wrong formats, field names only VA staff understand, no real-time access | Engineering Lead |

### Policy Constraints

> "Everything I do creates user friction. Authentication requirements create friction. Session timeouts create friction. Limited notifications create friction. The privacy-protective design is the friction-heavy design." — Policy SME

> "The authentication requirements create a first-impression problem. The app's onboarding experience—the first thing veterans encounter—is dictated by policy, not design." — Design Lead

| Constraint | Impact | User Experience Effect | Source(s) |
|------------|--------|------------------------|-----------|
| IAL2 Identity Assurance (NIST 800-63) | Government ID verification required for PHI access | 40% of veterans abandon multi-step identity proofing; never return to app | Policy SME, Engineering Lead, Design Lead |
| 30-minute session timeout | Policy-mandated for PHI security | Disrupts mobile usage patterns; veterans logged out mid-task | Policy SME, Design Lead |
| No PHI in notifications | Lock screen visibility risk | All notifications vague ("You have a message" vs "Dr. Smith responded") | Policy SME, Design Lead |
| No family/caregiver sharing | Individual authentication required; delegation framework years away | Most requested feature cannot be implemented | Policy SME, Engineering Lead |
| Minimum necessary data standard | Can't collect data "in case useful"; every field needs documented purpose | Limited behavioral analytics; can't track user journeys like commercial apps | Policy SME |

### Resource Constraints

> "We have 12 engineers supporting an app with 2.3 million active users. For comparison, a fintech app of similar complexity might have 50-100 engineers." — Engineering Lead

| Constraint | Impact | Systemic Effect | Source(s) |
|------------|--------|-----------------|-----------|
| 12 engineers for 2.3M users | Massive understaffing vs commercial standards | 4-6 month hiring backfill; remaining team absorbs departed member's work | Engineering Lead |
| 6 designers for 2M+ veterans | No time for proper discovery → testing → iteration | Skip user testing; ship assumptions; find problems after launch | Design Lead |
| 2-8 week privacy review process | Single privacy counsel serves all VA digital products | Features delayed; team must engage 6 months before launch | Policy SME |
| Shared backend team capacity | Mobile API Gateway team serves multiple VA products | Mobile is one of many clients; backend teams even more understaffed | Engineering Lead |

---

## 🎯 Strategic Priorities

> "Everything we do creates user friction. Authentication requirements create friction. Session timeouts create friction. Limited notifications create friction. The privacy-protective design is the friction-heavy design." — Policy SME

> "The honest truth is that 'serving users' and 'serving leadership visibility' aren't always aligned. A feature that affects 100,000 veterans daily might get deprioritized for a feature that will be in a press release, even if that feature affects 5,000 veterans." — Engineering Lead

| Priority | Driver | Timeline | Aligns With User Needs? | Source |
|----------|--------|----------|:-----------------------:|--------|
| Mandatory compliance (security patches, accessibility remediation, app store policy) | Legal/regulatory requirements | Immediate | ⚠️ | Engineering Lead |
| Leadership visibility features | Congressional inquiries, press releases, VA Secretary mentions | 3-6 months | ❌ | Engineering Lead |
| Backend API improvements (claims, health records) | User demand + technical debt | 6+ months (dependent on other teams) | ✅ | All stakeholders |
| Authentication/identity modernization | Policy evolution + user friction | 1-2 years | ✅ | Policy SME |
| High-visibility, high-risk features | Risk management + stakeholder attention | Varies | ⚠️ | Design Lead |
| User-requested features (family sharing, calendar export) | Direct user feedback | Blocked indefinitely | ✅ | All stakeholders |

**Critical Alignment Gap:** Features that would help the most veterans (family access, faster authentication, richer notifications) are blocked by policy constraints, while features that generate leadership visibility get prioritized regardless of user impact. The 40% onboarding abandonment rate persists because fixing it requires policy changes, not feature development.

---

## ⚙️ Backstage Processes

### New Feature Development and Approval

> "Total timeline for 'just show lab results': 6-9 months. The actual engineering work is maybe 15% of that time." — Engineering Lead

> "My review typically takes 2-3 weeks for straightforward features, 6-8 weeks for complex ones involving new data types or sharing arrangements." — Policy SME

**Frontend Steps (User-Facing):**
1. User requests feature via feedback, support tickets, or research
2. Feature appears on product roadmap (may wait months in backlog)
3. User sees feature announcement or beta release
4. User experiences staged rollout (1% → 5% → 25% → 100% over 3-4 weeks)

**Backend Steps (Invisible to User):**
1. **API Discovery** — Engineering determines if backend API exists or needs creation (2-4 weeks)
2. **Product Review Board** — Monthly prioritization meeting, features can queue for months
3. **Architecture Review** — Enterprise Architecture team reviews technical approach (2-3 weeks)
4. **Backend API Development** — Health/Benefits API teams create or modify endpoints (8-16 weeks)
5. **Mobile Gateway Integration** — Gateway team exposes API to mobile app (4-8 weeks, 6-month backlog)
6. **Security Assessment** — Information Security reviews data handling, encryption, logging (4-6 weeks)
7. **Privacy Impact Assessment** — Privacy Office reviews data collection/sharing (6-8 weeks for complex features)
8. **508 Accessibility Review** — Internal accessibility team tests with assistive technology (2-3 weeks)
9. **ATO Boundary Check** — Authority to Operate review if security boundary changes (3-6 months)
10. **Mobile Development** — Engineering builds UI and integration (2-3 sprints)
11. **App Store Review** — Apple/Google approval process (1-3 days, can reject unexpectedly)
12. **Staged Rollout** — Gradual release with monitoring (3-4 weeks)

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| Mobile Gateway bottleneck | 6-month backlog for gateway changes | Features promised but not delivered for months | Every new feature |
| Security assessment cycles | Multiple rounds of questions/revisions | Feature scope gets reduced to pass review | ~30% of features |
| Backend API unavailability | Engineering discovers needed API doesn't exist | User-requested features marked "not technically feasible" | ~40% of user requests |
| App store policy changes | Features removed without warning (background location killed) | Working features suddenly disappear | Unpredictable |

**Systems Involved:** Product Review Board, Enterprise Architecture, VHA/VBA API systems, Mobile API Gateway, Information Security, Privacy Office, 508 Accessibility Team, ATO Authority, Apple App Store, Google Play Store

---

### Veteran Authentication and Session Management

> "40% of veterans who start this process don't complete it. They delete the app and never come back." — Engineering Lead

> "The authentication requirements come from multiple sources, all pointing in the same direction: high assurance. For accessing health records (PHI), we need IAL2—identity proofing that verifies the person is who they claim to be." — Policy SME

**Frontend Steps (User-Facing):**
1. Veteran downloads app from App Store/Google Play
2. Taps "Sign In" → redirected to Login.gov or ID.me choice screen
3. **Identity Proofing Process:**
   - Account creation with email/password
   - Phone number verification via SMS
   - Government ID upload (driver's license/passport)
   - Selfie capture for facial recognition
   - Sometimes requires video call with identity agent ← **40% abandon here**
4. Multi-factor authentication setup (SMS or authenticator app)
5. Return to VA app, biometric setup (Face ID/Touch ID)
6. Access granted to app features
7. **Session timeout after 30 minutes** → biometric re-auth required

**Backend Steps (Invisible to User):**
1. **Identity Verification** — ID.me/Login.gov validates government ID against databases (2-10 minutes)
2. **Facial Recognition** — Biometric matching of selfie to ID photo (30 seconds - 2 minutes)
3. **Risk Assessment** — Fraud detection algorithms score the verification attempt
4. **VA Profile Matching** — Identity linked to veteran record in VA Profile system
5. **Session Token Generation** — JWT tokens created with 30-minute expiration
6. **Biometric Storage** — Device-level biometric template stored (never reaches VA)
7. **Session Monitoring** — Continuous validation of session integrity
8. **Automatic Logout** — Session terminated after 30 minutes inactivity

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| ID photo capture failure | Mobile camera can't capture clear ID image | "Photo rejected" errors, multiple retry attempts | ~25% of attempts |
| Facial recognition failure | Selfie doesn't match ID photo sufficiently | Escalated to video call verification | ~15% of attempts |
| Session timeout during onboarding | 30-minute limit expires during setup | Forced to restart entire process | ~10% of sessions |
| Biometric setup failure | Face ID/Touch ID enrollment fails | Falls back to password re-entry every session | ~5% of devices |

**Systems Involved:** ID.me, Login.gov, VA Profile, VistA, device biometric systems (iOS Secure Enclave, Android Keystore), JWT token management, fraud detection systems

---

### Claims Status Data Retrieval

> "The claims status endpoint is particularly bad. It aggregates data from multiple VBA systems, and the aggregation happens synchronously. If one system is slow, everything's slow." — Engineering Lead

> "What the API gives us is: claim type, filing date, status (one of about 8 values), and sometimes a vague 'steps completed' indicator. That's not enough for veterans who want to understand why their claim is taking six months." — Design Lead

**Frontend Steps (User-Facing):**
1. Veteran taps "Claims" in app navigation
2. Loading spinner displays (veterans see this for 8-12 seconds typically)
3. Claims list appears with basic status information
4. Veteran taps individual claim for details
5. Another loading state (3-5 seconds)
6. Limited claim details display (status, date filed, claim type only)

**Backend Steps (Invisible to User):**
1. **Mobile API Gateway** receives request, validates session token
2. **VBA Claims API** called to retrieve veteran's claims list
3. **Synchronous aggregation** across multiple VBA legacy systems:
   - VBMS (Veterans Benefits Management System) for claim documents
   - BGS (Benefits Gateway Service) for claim status
   - SHARE (legacy mainframe) for historical data
   - Corporate Database for examiner assignments
4. **Data transformation** from internal codes to display values
5. **Response assembly** with available fields only
6. **Cache update** (limited 4-hour cache due to data sensitivity)
7. **Response delivery** to mobile app

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| Legacy system timeout | One of 4 backend systems doesn't respond in time | "Unable to load claims" error after 12+ second wait | ~15% of requests |
| Data inconsistency | Different systems have conflicting status information | Claim shows "Decision made" but also "Gathering evidence" | ~8% of claims |
| Missing examiner data | Corporate Database doesn't expose examiner assignments | Veterans can't see who's handling their claim | 100% of claims |
| Status terminology changes | VBA changes internal codes without API notification | Plain-language translations break, show technical jargon | Unpredictable |

**Systems Involved:** Mobile API Gateway, VBA Claims API, VBMS, BGS, SHARE mainframe, Corporate Database, Redis cache layer

---

### Push Notification Delivery

> "Any notification content is potentially visible to someone other than the veteran. We've taken an extremely conservative position: no PHI in notification content, ever." — Policy SME

> "I'd love to show message previews on the lock screen—'Dr. Smith responded to your message.' But that could expose who the veteran's doctor is, which is considered PHI. So our notifications say 'You have a new secure message.'" — Design Lead

**Frontend Steps (User-Facing):**
1. Veteran enables notifications during app setup
2. Receives generic notifications: "You have a new secure message" or "Appointment reminder"
3. Must open app to see actual content
4. Notification appears on lock screen, notification center, potentially other synced devices

**Backend Steps (Invisible to User):**
1. **Trigger Event** — Backend system detects notification-worthy event (new message, appointment change)
2. **Privacy Filtering** — Content scrubbed of all PHI (doctor names, clinic names, medical details)
3. **Notification Service** — VA notification service generates generic message
4. **Platform Routing** — Sent to Apple Push Notification Service (APNS) or Firebase Cloud Messaging (FCM)
5. **Device Delivery** — Platform delivers to veteran's device
6. **Analytics Collection** — Delivery confirmation and engagement tracking (limited by privacy policy)

**Where It Breaks Down:**

| Failure Point | What Happens | User Experience | Frequency/Severity |
|---------------|--------------|-----------------|-------------------|
| Over-generic content | PHI restrictions make notifications uninformative | Veterans ignore notifications as unhelpful | 100% of notifications |
| Platform delivery failure | APNS/FCM doesn't deliver to device | Veterans miss important updates | ~5% of notifications |
| Device sharing exposure | Notifications visible to family members using shared device | Privacy concerns but no technical failure | Unknown frequency |
| Timezone confusion | Backend doesn't account for veteran's location | Appointment reminders at wrong time | ~10% of location-based notifications |

**Systems Involved:** VHA messaging systems, VBA benefits systems, VA Notification Service, Apple Push Notification Service, Firebase Cloud Messaging, analytics platforms (limited data collection)

---

### Health Data Display and Caching

> "HIPAA requires technical safeguards (encryption), administrative safeguards (access controls), and physical safeguards (device security). HIPAA also restricts how we can use PHI for app improvement—we can't data-mine health records to optimize features without explicit consent." — Policy SME

> "We could pre-populate forms with saved data, but policy limits what we can cache. We could show appointment details on the lock screen notification, but that might expose PHI to someone looking over the veteran's shoulder." — Engineering Lead

**Frontend Steps (User-Facing):**

---

## 🎯 Service Blueprint Implications

> Key inputs for backstage/support layer mapping

### Frontstage Moments That Depend on Fragile Backstage

| Frontstage Moment | Backstage Dependency | Failure Mode |
|-------------------|----------------------|--------------|
| Veteran taps "Check claim status" | VBA Claims API aggregates data from multiple legacy systems synchronously | 8-12 second wait or timeout; veteran thinks app is broken |
| Veteran completes identity proofing | ID.me/Login.gov mobile camera capture → document verification → SMS codes | 40% abandonment rate; veterans delete app assuming it's broken |
| Veteran receives notification | Push content filtered through PHI policy review → generic message generation | "You have a message" tells veteran nothing useful |
| Veteran tries to use app after 30 minutes | Session timeout policy triggers → biometric re-auth required | Veteran loses form progress, doesn't understand why logged out |
| Veteran requests prescription refill | Mobile API Gateway → VistA health system → pharmacy system chain | Any system failure breaks entire flow; no partial success |
| New feature launches | 6-8 week privacy review → security assessment → gateway team (6-month backlog) | Features appear "simple" but take 6-9 months to deliver |

### Support Processes Currently Manual

| Process | Current State | Risk |
|---------|---------------|------|
| Privacy Impact Assessments | Legal counsel manually reviews every feature touching veteran data (2-8 weeks) | Single point of failure; delays all feature releases |
| API Gateway Changes | Shared team manually implements endpoints for each mobile feature request | 6-month backlog creates bottleneck for all mobile development |
| Cross-platform testing | Manual testing on device lab that's "not comprehensive" per Engineering Lead | Bugs ship to specific device/OS combinations that weren't tested |
| Backend error translation | Engineering manually maps cryptic system errors to user-friendly messages | Veterans see "Unable to load data" for dozens of different backend failures |
| Claims status terminology | Design team manually maintains translations of VBA jargon to plain language | Translations break when VBA changes terms without notice |
| Session timeout warnings | No proactive notification system; veterans discover timeout when they try to act | Veterans lose work and don't understand why |

### Line of Visibility Gaps

| Users See | Users Don't See | Creates Confusion When... |
|-----------|-----------------|---------------------------|
| "Loading..." spinner for 10+ seconds | Claims API aggregating data from 3+ legacy VBA systems | Veterans think app is frozen, force-quit and retry |
| Generic notification: "You have a new message" | PHI policy prevents showing doctor name or message preview | Veterans can't prioritize which messages are urgent |
| Identity proofing failure: "Please try again" | ID.me camera capture failing due to mobile-specific technical issues | Veterans blame themselves for "doing it wrong" |
| Session expired, please log in | 30-minute inactivity timeout policy requirement | Veterans think app is buggy, don't understand security rationale |
| Feature not available in app | Backend API doesn't exist or Mobile Gateway hasn't implemented endpoint | Veterans assume mobile team is lazy or incompetent |
| "Unable to load data" error | Specific backend system (VistA, VBA claims, etc.) is down or slow | Veterans don't know if problem is temporary, permanent, or their fault |

---

## 🔍 Questions for User Research

> Based on stakeholder input, explore these with participants

### High Priority (🔴)

| Stakeholder Insight | Research Question | Method |
|---------------------|-------------------|--------|
| 40% of veterans abandon identity proofing setup (Engineering) | At what specific step do veterans abandon onboarding, and what are they thinking/feeling at that moment? | Moderated usability testing with think-aloud during setup process |
| Veterans don't know if 8-12 second loading is working or broken (Engineering) | How long will veterans wait before assuming the app has failed? What loading feedback would help them understand progress? | Task-based testing with artificial delays; measure abandonment thresholds |
| "Family access" is most requested feature that policy prevents (Legal/Engineering) | What specific family/caregiver scenarios drive this request? How do veterans currently work around this limitation? | Contextual interviews about family healthcare coordination |
| Veterans experience session timeout as app being "buggy" (Design) | Do veterans understand why sessions expire? Would they accept timeout if they understood the security rationale? | Concept testing of timeout explanations and warning systems |
| Claims status terminology changes break translations (Design) | What claim status language actually makes sense to veterans? Which terms cause the most confusion? | Card sorting and comprehension testing of claim status language |

### Medium Priority (🟡)

| Stakeholder Insight | Research Question | Method |
|---------------------|-------------------|--------|
| Notifications are vague due to PHI policy but veterans find them unhelpful (Legal/Design) | What level of detail in notifications would be useful vs. concerning from privacy perspective? | Preference testing of notification content variations |
| Veterans want calendar export but clinic names are considered PHI (Engineering) | How do veterans currently manage VA appointments in their personal calendars? What information is essential vs. nice-to-have? | Diary study of appointment management workflows |
| VHA vs VBA features compete for home screen prominence (Design) | How do veterans mentally categorize health vs. benefits? Do they see these as integrated or separate needs? | Mental model interviews and information architecture card sorting |
| Backend errors all show as "Unable to load data" (Engineering) | What context would help veterans understand if errors are temporary, permanent, or actionable? | Prototype testing of error message variations |
| App store policy changes can kill features without warning (Engineering) | How do veterans react when features they rely on suddenly disappear? What communication would help? | Retrospective interviews about feature changes |

### Validation Questions (🟢)

| Stakeholder Assumption | Validate With Users |
|------------------------|---------------------|
| "Veterans would accept slower performance if they understood why" (Engineering) | Test transparent performance messaging: does explaining backend complexity increase patience/satisfaction? |
| "Veterans don't read privacy notices anyway" (Legal) | Observe privacy notice interaction: do veterans actually skip them, or do they want to understand but can't? |
| "Mobile users expect simple experiences, not feature parity with web" (Design) | Validate mobile-first vs. feature-complete preferences: what would veterans sacrifice for simplicity? |
| "Veterans prioritize security over convenience once they understand the trade-offs" (Legal) | Test security explanation concepts: does understanding IAL2 requirements change veteran attitudes toward authentication friction? |
| "Loading animations and skeleton screens make waiting feel shorter" (Design) | A/B test loading experience variations: do design improvements actually impact perceived performance? |
| "Veterans with only health needs don't want benefits features cluttering their experience" (Design) | Validate personalization assumptions: do single-domain users want streamlined experience or comprehensive access? |

---

## ❓ Open Questions

> Questions that couldn't be answered — need follow-up interviews or data

### Immediate Follow-Up Needed (🔴)

| Question | Who Might Know | Why It Matters |
|----------|----------------|----------------|
| What's the realistic timeline for caregiver/family delegation framework? | Michael Okonkwo (VA Chief Privacy Officer), VHA delegation team | Most requested feature; affects roadmap planning and user expectations |
| Can we see the 40% onboarding abandonment data breakdown by step? | Engineering analytics team, Product team | Critical conversion issue; need to identify specific drop-off points |
| What would passwordless primary authentication require policy-wise? | Evelyn Tran (Legal), NIST identity standards team | Could significantly reduce login friction while maintaining security |
| How are VHA vs VBA roadmap conflicts resolved in practice? | OCTO leadership, Product Owner | Affects feature prioritization and resource allocation |

### Needs Policy/Legal Clarification (🟡)

| Question | Who Might Know | Why It Matters |
|----------|----------------|----------------|
| Could a "privacy dashboard" showing veteran data access be approved? | Evelyn Tran (Legal), Samantha Reyes (OCTO Privacy) | Would address transparency complaints without overwhelming consent screens |
| What's preventing API improvements for claims detail data? | Carmen Delgado (VBA Benefits API), VBA leadership | Core user need; understanding blockers could inform advocacy strategy |
| How do state privacy laws affect veteran expectations we need to manage? | Legal team, policy monitoring | Growing compliance landscape may create expectation gaps |

### Requires Cross-Team Coordination (🟡)

| Question | Teams Involved | Why It Matters |
|----------|----------------|----------------|
| What would dedicated mobile-optimized backend services require? | Engineering, Backend teams, Enterprise Architecture | Could solve fundamental performance and capability constraints |
| How can Mobile API Gateway bottleneck be addressed? | Mobile team, Gateway team, OCTO leadership | 6-month backlog affects every new feature |
| What's the roadmap for VADS mobile component improvements? | Design team, VA.gov Design System team | Affects design consistency and development speed |

---

## 📋 Recommendations

### Immediate Actions (🔴 High Priority)

| Action | Constraint Addressed | Feasibility | Owner |
|--------|---------------------|-------------|-------|
| Create template privacy review process for standard mobile patterns | 2-8 week privacy review delays | ✅ | Legal team (Evelyn already started this) |
| Implement detailed onboarding analytics to identify specific drop-off points | 40% onboarding abandonment | ✅ | Engineering team |
| Establish regular VHA/VBA roadmap coordination meetings | Competing stakeholder priorities | ⚠️ | Product Owner + OCTO |
| Document and share "aspirational designs" with backend teams for API advocacy | Limited claims data availability | ✅ | Design team |

### Near-Term Actions (🟡 Medium Priority)

| Action | Constraint Addressed | Feasibility | Owner |
|--------|---------------------|-------------|-------|
| Pilot privacy dashboard feature for veteran data transparency | Privacy confusion, consent fatigue | ⚠️ | Design + Legal collaboration |
| Advocate with ID.me/Login.gov for mobile-specific onboarding improvements | Identity proofing friction | ⚠️ | Product team + Legal |
| Create mobile-specific VADS components for common patterns | Design system gaps | ⚠️ | Design team + VADS team |
| Establish SLA with Mobile API Gateway team for feature development | 6-month gateway backlog | ⚠️ | Engineering + Gateway teams |

### Strategic Actions (🟢 Long-Term)

| Action | Constraint Addressed | Feasibility | Owner |
|--------|---------------------|-------------|-------|
| Business case for dedicated mobile backend services | Backend response times, offline capability | ❌ | OCTO leadership |
| Develop veteran-centered delegation framework with abuse safeguards | Family sharing requests | ❌ | Legal + Product + VHA |
| Create mobile-first identity verification flow separate from web | Onboarding friction | ❌ | Enterprise Architecture + Legal |
| Implement real-time claims status API with detailed veteran-facing information | Claims transparency | ❌ | VBA + Engineering |

---

## 📚 Methodology

**Framework:** Stakeholder Research Synthesis for Service Design

**Approach:** Aggregated findings from 3 internal stakeholder interviews (Legal/Policy, Engineering, Design), organized by constraint type, priority alignment, and backstage process mapping. Cross-referenced insights across technical, design, and policy perspectives to identify systemic patterns and root causes.

**Key Synthesis Methods:**
- Constraint triangulation (same issue from technical, design, and policy angles)
- Process mapping with failure mode identification
- Priority alignment analysis (stated priorities vs. user needs)
- Open question documentation for follow-up

**Data Sources:**
- Evelyn Tran, Senior Privacy Counsel & Policy SME (52 minutes)
- Tomás Reyes, Engineering Lead (54 minutes)  
- Jasmine Oyelaran, Design Lead (49 minutes)

---

## 👥 Recommended Next Interviews

| Name/Role | Team | Focus Area | Priority |
|-----------|------|------------|----------|
| Michael Okonkwo, VA Chief Privacy Officer | Enterprise Policy | Enterprise policy rationale, delegation timeline | 🔴 |
| Priya Sharma, Mobile API Gateway Lead | Infrastructure | Gateway bottleneck solutions, capacity planning | 🔴 |
| Carmen Delgado, VBA Benefits API Team | Backend Systems | Claims data constraints, API improvement roadmap | 🔴 |
| David Washington, Information Security Lead | Security | Security review process, policy rationale | 🟡 |
| Samantha Reyes, OCTO Privacy Lead | Technical Policy | Technical implementation of privacy requirements | 🟡 |
| Login.gov/ID.me product teams | Identity Vendors | Authentication roadmap, mobile improvements | 🟡 |
| Ryan Chen, Content Designer | Design | Language constraints, legal terminology requirements | 🟡 |
| Veterans who churned from app | End Users | Why they deleted app, unmet expectations | 🔴 |
| VA mobile app beta program veterans | End Users | Longitudinal perspective on app evolution | 🟡 |

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

*Generated by Qori • January 26, 2026*
