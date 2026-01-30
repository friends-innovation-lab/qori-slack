# Stakeholder Interview Response

> **Study:** VA Health and Benefits Mobile App
> **Stakeholder:** Dr. Rebecca Okonkwo, Policy & Compliance SME
> **Date:** January 28, 2026
> **Duration:** 55 minutes
> **Interviewer:** Research Team

---

## Participant Profile

| | |
|---|---|
| **Name** | Dr. Rebecca Okonkwo |
| **Role** | Senior Policy Analyst, VA Office of Information Security & Privacy |
| **Tenure** | 7 years at VA, 18 years in healthcare privacy/compliance |
| **Background** | JD, Healthcare Law; CIPP/US certification |
| **Primary Focus** | HIPAA compliance, Section 508, PII protection, authentication policy, consent frameworks |

---

## Opening Context

**"Can you tell me about your role and how you work with the mobile app team?"**

> "I'm part of the Office of Information Security and Privacy. My job is ensuring VA digital products comply with federal regulations—HIPAA, Privacy Act, Section 508, and VA-specific policies.
>
> For the mobile app, I'm the **policy checkpoint**. Before any feature ships that touches veteran data, I review it. Authentication changes, data display decisions, notification content—all of that comes through my office.
>
> I understand I'm often seen as the **'no' person**. The team comes with ideas, and I explain why policy prevents certain implementations. I wish I could say 'yes' more often, but my job is risk mitigation. A privacy breach affecting veterans would be catastrophic—not just legally, but for veteran trust in VA.
>
> That said, I try to be collaborative. If something can't be done one way, I work with the team to find alternatives. 'No' is really 'not that way—let's find another path.'"

---

## Section 1: Privacy and Data Protection

### Question 1: PHI Display Constraints

**"What privacy requirements most affect the mobile app experience?"**

> "**Protected Health Information (PHI)** is the big one. HIPAA is strict about how PHI can be displayed, transmitted, and stored. On mobile, this creates specific challenges.
>
> **Lock screen notifications** are a classic example. The team wanted rich notifications—'Dr. Smith confirmed your Tuesday appointment' or 'Your prescription is ready for pickup.' Both contain PHI. The doctor's name reveals the patient-provider relationship. The prescription implies a medical condition.
>
> We compromised on **minimal notifications**: 'You have a new secure message' or 'Appointment update available.' It's less useful, but it's private. A veteran's spouse, coworker, or anyone who sees their lock screen can't learn their health details.
>
> **Screen recording protection** is another area. Veterans take screenshots. That's fine for their own records, but if screenshot data leaves the device—shared on social media, sent in an email—PHI could be exposed. We've discussed prompts warning about PHI before screenshots, but the technical implementation is complex.
>
> **Session display** was debated extensively. Should the app show the names of previous session attendees? If a veteran had a mental health appointment, displaying the therapist's name next to the session could reveal the nature of care. We opted for minimal identifiers."

**Follow-up: "How do veterans feel about these privacy protections?"**

> "It's mixed. Some veterans appreciate the privacy. They tell us, 'I don't want my wife knowing every medical appointment I have.' Military culture often includes reluctance to share health struggles. Privacy protections support that.
>
> Others find it frustrating. They want the convenience of rich notifications. They say, 'It's my phone, my data, let me decide.' And they have a point.
>
> We've explored **user-controlled privacy settings**—letting veterans opt into richer notifications. The challenge is **informed consent**. How do we ensure veterans understand the risks? A checkbox that says 'I accept privacy risks' doesn't meet our bar for informed consent. We'd need clear explanations of what could be exposed and how.
>
> The legal team is cautious. If a veteran opts into lower privacy and then experiences harm from that exposure, is VA liable? That question is unresolved."

---

### Question 2: PII Protection Requirements

**"How does PII protection affect app design?"**

> "Beyond PHI, we protect **Personally Identifiable Information**—Social Security Numbers, addresses, financial data. Much of this is governed by the Privacy Act, not HIPAA.
>
> The app displays sensitive PII in several places. **Masking** is our primary tool. Social Security Numbers appear as XXX-XX-1234. Bank account numbers are partially hidden.
>
> **Copy-to-clipboard** was debated. If a veteran can copy their SSN to paste elsewhere, is that a risk? We decided yes—clipboard data can be accessed by other apps on the device. Some sensitive fields disable copy functionality.
>
> **Form autofill** creates tension. Veterans want convenience—autofill their address, their phone number. But autofill data is stored outside the app, in the device's credential manager. We can't control that storage. So we limit what fields support autofill.
>
> **Logging and analytics** are heavily restricted. We cannot log PHI or PII. That limits debugging. When something goes wrong for a veteran, we can't see the specific data involved—we see anonymized patterns. It makes troubleshooting harder, but it protects veterans."

---

### Question 3: Data Retention and Deletion

**"What policies govern how data is stored on the device?"**

> "We follow the principle of **minimum necessary data**. The app should cache only what's needed for functionality, for as short a time as possible.
>
> **Session data** is cleared on logout. If a veteran signs out, locally cached health records, appointment details, and personal information should be wiped. We've had bugs where data persisted unexpectedly—those are treated as security incidents.
>
> **Biometric data** stays on device; we never see it. The app asks iOS/Android to verify the person, and the OS returns yes/no. That's important for veterans to understand—VA doesn't have their fingerprints or face data.
>
> **Cache expiration** is policy-mandated. Certain data types expire after set periods. Prescription data, for example, shouldn't be viewable offline indefinitely. If the app can't verify the user is still authenticated, old cached data should not be accessible.
>
> This creates UX friction. Veterans open the app after a few days and cached data is gone—they need to reload. It feels slow and redundant, but it's intentional protection."

---

## Section 2: Authentication and Session Management

### Question 1: Identity Verification Requirements

**"What drives the identity verification requirements for the app?"**

> "Access to VA health and benefits data requires **Identity Assurance Level 2 (IAL2)** verification. This is federal policy, not VA choice. IAL2 means the person's identity has been verified against government records with a high degree of confidence.
>
> **ID.me and Login.gov** provide this verification. Their process—document upload, selfie verification, knowledge-based questions—is designed to meet IAL2. It's not pleasant, but it's thorough.
>
> For mobile specifically, the challenge is that **verification wasn't designed for mobile**. Taking photos of IDs, positioning documents correctly, dealing with camera quality—these are harder on phones than on computers with webcams. We've advocated for mobile-optimized verification flows, but ID.me and Login.gov have their own roadmaps.
>
> Once verified, we use **Multi-Factor Authentication (MFA)** for every login. This adds friction—veterans need their phone to receive codes or use biometrics. But the alternative is that anyone with a veteran's password could access their health records. MFA is essential."

**Follow-up: "Veterans report onboarding is painful. What options exist to improve it?"**

> "Within current policy, limited options. We can improve **instructions and guidance**—making the process feel less opaque. We can optimize **error recovery**—when document upload fails, providing clearer next steps.
>
> **Credential reuse** could help. If a veteran verified with Login.gov for another federal service, they shouldn't need to re-verify for VA. This is the intent, but implementation is incomplete. Credential federation across agencies is a work in progress.
>
> **Stepped access** is something we've discussed. Could a veteran access some features before full IAL2 verification? Maybe general information, but not their personal health records. This creates complexity—which features require which assurance level?—but could reduce barrier to entry.
>
> **Delegated identity** for caregivers is another area. A veteran's caregiver might need app access, but they're not the veteran. How do we authenticate them while maintaining the veteran's privacy? This is unsolved."

---

### Question 2: Session Timeout Policy

**"Why does the session timeout exist, and what flexibility is there?"**

> "**HIPAA Security Rule** requires safeguards against unauthorized access. Session timeout after inactivity is a standard safeguard. If a veteran leaves their phone unattended while logged into the app, an automatic timeout reduces the window of exposure.
>
> VA policy is **30 minutes of inactivity**. This is conservative compared to commercial apps but appropriate for PHI access. Some VA systems use 15 minutes; 30 is already a compromise.
>
> The challenge for mobile is that **mobile usage patterns are different**. Veterans check quickly, put the phone down, come back 45 minutes later. The timeout disrupts that pattern.
>
> **Biometric re-authentication** was our mitigation. Instead of full credential entry after timeout, veterans can use Face ID or Touch ID for quick re-entry. This maintains security—only the authorized person can resume—while reducing friction.
>
> The timeout itself can't be extended without policy change, which would require security review and risk acceptance at a high level. It's possible but not fast."

---

### Question 3: Consent and Terms of Service

**"What consent requirements affect the app experience?"**

> "**Terms of Service** must be presented and accepted. This happens during initial setup. The content is lengthy because it's legally required—it covers data use, privacy practices, and veteran rights.
>
> We've tried to balance **legal completeness** with **readability**. Plain language summaries were proposed, but legal counsel insisted the full text be visible. A summary might omit something material, creating liability.
>
> **Health data consent** is separate from app consent. When veterans share health data through features like Apple Health integration, additional consent is required. These consent flows can feel repetitive but serve different purposes.
>
> **Feature-specific consent** may be needed for certain capabilities. If we add AI-powered features that process veteran data in new ways, new consent disclosures may be required. Each feature is evaluated.
>
> The challenge is **consent fatigue**. Veterans see screens of legalese, scroll past, and tap agree. They're not informed; they're exhausted. But shortening the content without legal approval is not something we can do unilaterally."

---

## Section 3: Accessibility and Compliance

### Question 1: Section 508 Requirements

**"How does Section 508 compliance affect development?"**

> "Section 508 requires federal electronic information to be accessible to people with disabilities. For mobile apps, this means **WCAG 2.1 AA compliance** as a baseline.
>
> The mobile app is subject to Section 508 review. Before major releases, the app is tested for accessibility compliance. Findings are documented and must be remediated or accepted with risk documentation.
>
> From a policy perspective, **accessibility is non-negotiable**. We cannot launch features that are inaccessible to veterans with disabilities. Veterans who are blind, have motor impairments, or have cognitive differences have equal right to access their benefits.
>
> The tension is timing. **Remediation takes time**. If an accessibility issue is found late in development, the choice is delay release or ship with known issues. Neither is ideal. Earlier integration of accessibility testing prevents this, but process maturity varies.
>
> We've pushed for **accessibility champions** embedded in product teams rather than accessibility being a gate at the end. Prevention is cheaper than remediation."

---

### Question 2: Legal Risk Considerations

**"What legal risks do you monitor related to the app?"**

> "**Privacy breach liability** is the primary concern. If veteran PHI is exposed through an app vulnerability, VA faces regulatory action, potential lawsuits, and congressional scrutiny.
>
> **Accessibility lawsuits** are real. Federal agencies have been sued for inaccessible digital services. While VA hasn't faced a mobile app-specific suit, the risk exists if we knowingly ship inaccessible features.
>
> **Misinformation risk** is emerging. If the app displays incorrect health or benefits information, and a veteran acts on that information to their detriment, there's potential liability. Data accuracy isn't just UX—it's legal exposure.
>
> **AI/ML liability** is a newer area. If we implement AI features that make recommendations—'You may be eligible for X'—and those recommendations are wrong, what's our exposure? This is why AI features go through careful review before implementation.
>
> **Terms of Service violations** can create issues. If we promise data handling practices in our terms and then don't follow them, that's an FTC concern, even for government apps."

---

## Section 4: Connecting to User Research

**"Users report frustration with onboarding. From a policy perspective, what's driving that?"**

> "IAL2 identity verification is driving most of it. The **document photography, selfie matching, and knowledge questions** are federal requirements for accessing this level of sensitive data.
>
> From policy's perspective, the friction is **working as intended**. Strong identity verification prevents bad actors from accessing veteran data. If onboarding were easy, it would also be easy to impersonate someone.
>
> That said, I'm sympathetic. The experience is frustrating. We've reviewed the error messages, the instructions, the flow. We've pushed ID.me for mobile improvements. But the fundamental requirement—proving you are who you say you are—takes time.
>
> **Reframing** might help. If veterans understood that the process protects them from identity theft and fraud, they might accept it more readily. It's not bureaucratic friction; it's security. Messaging matters."

---

**"Users want more information about their claims status. What policy constraints affect that?"**

> "Claims data comes from VBA systems with their own **data governance**. What fields are exposed to which systems is controlled by inter-agency agreements.
>
> Some information veterans want—like detailed examiner notes or internal workflow status—may be **deliberative** or **pre-decisional**. Exposing it could affect the fairness of the process or create legal complications if decisions are later challenged.
>
> **Plain language requirements** are also relevant. If we display technical claims terminology, we should translate it. But translations must be accurate. An inaccurate translation that leads a veteran to misunderstand their status could be harmful.
>
> The claims status display is a collaboration between app team, VBA, and policy. Each stakeholder has constraints. Improving it requires coordination."

---

**"Users find consent screens frustrating. What flexibility exists there?"**

> "Legal content cannot be shortened without legal approval, and legal is conservative. Their job is protecting VA from liability, and consent language is their tool.
>
> **Layered consent** is something we've explored. A short summary upfront, with 'read full terms' for details. Legal has concerns that summaries could omit material information. We've not reached agreement.
>
> **Just-in-time consent** could replace upfront consent for some features. Instead of consenting to everything at signup, consent when a feature is first used. This spreads the friction but also makes it contextual.
>
> **Visual presentation** improvements don't require legal changes. Better typography, scannable formatting, progress indicators. These are UX decisions that could make the same content feel less oppressive.
>
> I'd recommend **user research on consent**. What do veterans actually want to know? What risks are they concerned about? That data could help us argue for specific consent improvements."

---

## Closing

**"What constraint or challenge haven't I asked about that significantly impacts the app?"**

> "**Inter-agency dependencies**. The mobile app consumes data from VHA and VBA, which have their own privacy officers, their own policies, and their own priorities. Coordination is slow. When we want to change how data is displayed, multiple stakeholders have to agree.
>
> **Policy evolution** is slow. Regulations written for paper records and desktop computers don't always fit mobile gracefully. Updating them requires regulatory process—not something that happens in months.
>
> **Emerging technology policy** is reactive. AI, biometrics, and new platform capabilities arrive faster than policy can anticipate. We're often making decisions about new features without clear guidance, which means erring on the side of caution.
>
> **Veteran expectations** are shaped by commercial apps that don't have our constraints. When veterans compare the VA app to their banking app, they wonder why VA is harder. But banks don't handle PHI, and they're not subject to federal accessibility law."

---

**"Who else should I talk to to better understand policy constraints?"**

> "**Office of General Counsel**—they're the ones who approve consent language and assess legal risk. Understanding their perspective would help.
>
> **VBA Privacy Officer**—they govern claims data specifically. Their constraints may differ from health data constraints.
>
> **508 Compliance Office**—they can explain the accessibility review process and what triggers escalation.
>
> **ID.me/Login.gov product teams**—they set the identity verification experience. Understanding their constraints and roadmap would explain why certain improvements aren't happening faster."

---

**"Can I follow up if I have questions?"**

> "Of course. rebecca.okonkwo@va.gov. I'm also available via Slack @rokonkwo.
>
> If your research identifies specific policy pain points—features that would help veterans but feel blocked by policy—I want to hear about them. Sometimes policy can evolve if the case is strong enough. Research findings are evidence that can support policy change proposals."

---

## Post-Interview Notes

### Key Constraints Identified

1. **PHI Lock Screen Restrictions**: Rich notifications would expose health information; limited to generic alerts
2. **IAL2 Identity Verification**: Federal requirement for PHI access; mobile verification flow not optimized
3. **30-Minute Session Timeout**: HIPAA security requirement; disrupts mobile usage patterns
4. **Consent Content Length**: Legal requires full terms visible; no summaries without approval
5. **Inter-Agency Coordination**: VHA, VBA, ID.me all have own policies; changes require multi-stakeholder agreement
6. **Pre-Decisional Data**: Some claims information can't be exposed due to deliberative privilege

### Surprising Insights

- User-controlled privacy settings (opt-in to richer notifications) blocked by informed consent questions
- "Consent fatigue" acknowledged as problem, but legal team won't approve shortened versions
- Clipboard copy disabled for some sensitive fields to prevent cross-app data access
- Accessibility is non-negotiable from policy perspective—features cannot ship inaccessible
- AI/ML features face heightened liability scrutiny for recommendations that could be wrong

### Connections to User Research

| User Finding | Policy Context |
|--------------|----------------|
| Onboarding frustration | IAL2 verification is federal requirement; friction is by design for security |
| Want more claim detail | Some information is pre-decisional/deliberative; inter-agency data governance limits exposure |
| Consent screens tedious | Legal requires full text visible; layered consent proposals not approved |
| Notifications not useful | PHI can't appear on lock screen; current minimal notifications are policy-compliant |

### Follow-up Questions

1. Is there appetite for user research specifically on consent experience to inform legal discussions?
2. What would a proposal for layered consent need to include to get legal approval?
3. Are there any upcoming policy reviews where mobile-specific guidance could be introduced?
4. What's the process for proposing user-controlled privacy settings with proper informed consent?

### Recommended Additional Interviews

| Name | Role | Focus Area |
|------|------|------------|
| Office of General Counsel | Legal Risk | Consent language, liability concerns |
| VBA Privacy Officer | Benefits Data | Claims data governance, exposure limits |
| 508 Compliance Office | Accessibility | Review process, escalation triggers |
| ID.me/Login.gov Product | Identity | Verification flow roadmap, mobile improvements |

---

*Interview documented by Research Team*
*Qori-generated guide used - January 28, 2026*
