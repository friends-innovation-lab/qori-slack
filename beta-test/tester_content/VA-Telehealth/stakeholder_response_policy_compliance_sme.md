# 📋 Stakeholder Interview Response

> **Study:** VA Telehealth Onboarding and Appointment  
> **Stakeholder:** Denise Whitfield, Policy & Compliance SME  
> **Date:** January 21, 2026  
> **Duration:** 51 minutes  
> **Interviewer:** Jordan (UX Researcher)

---

## Participant Profile

| | |
|---|---|
| **Name** | Denise Whitfield, JD, CIPP/G |
| **Role** | Senior Policy Analyst & Compliance Officer, VA Office of Connected Care |
| **Tenure** | 7 years at VA, 15 years in federal health IT compliance |
| **Certifications** | Certified Information Privacy Professional/Government (CIPP/G), HIPAA Privacy & Security |
| **Primary Focus** | Telehealth regulatory compliance, privacy policy, consent management, interstate licensing |

---

## Opening Context

**"Can you tell me about your role and how you interact with the VA Telehealth system and policies?"**

> "I'm the person who says 'no' a lot, and then tries to find a way to say 'yes, but.'
>
> My role is to ensure that everything we build and deploy in VA telehealth complies with federal law, VA policy, and healthcare regulations. That includes HIPAA, the Privacy Act, Section 508 accessibility requirements, FedRAMP for our cloud systems, and a whole constellation of VA-specific directives.
>
> I interact with the telehealth system at every stage of development. Before a feature is designed, I'm reviewing whether it's even permissible. During development, I'm checking that consent language is correct, data handling meets requirements, and audit trails are in place. After launch, I'm monitoring for compliance issues and responding to incidents.
>
> I also spend a significant amount of time on policy interpretation. The laws and regulations we operate under weren't written with modern telehealth in mind. HIPAA is from 1996. The Privacy Act is from 1974. I'm constantly translating 20th-century legal frameworks into guidance for 21st-century technology."

---

## Section 1: Constraints (Technical, Policy, Resource)

### Question 1: Technical Constraints

**"What are the biggest technical constraints affecting the performance of the VA Telehealth system?"**

> "From a compliance perspective, the biggest technical constraint is audit logging. Every interaction with Protected Health Information has to be logged—who accessed what, when, from where, for what purpose. This isn't optional; it's a HIPAA requirement and a VA policy requirement.
>
> The challenge is that comprehensive logging creates performance overhead. Every database query, every screen view, every action generates a log entry. At scale—and VA operates at massive scale, serving 9 million enrolled veterans—that's billions of log entries. The systems that store and process those logs become bottlenecks themselves.
>
> We've had situations where the audit logging system was so backed up that it caused latency in the primary application. Veterans experienced slow page loads not because of the telehealth system itself, but because the compliance infrastructure couldn't keep up. That's a terrible user experience caused by a non-negotiable compliance requirement."

**Follow-up: "Can you provide examples of how these technical constraints impact user experience?"**

> "The consent verification process is a good example. Before a veteran can access telehealth, we have to verify they've consented to: 1) electronic communication, 2) telehealth specifically, 3) sharing information with the specific provider, and in some cases, 4) sharing information across state lines if the provider is in a different state.
>
> Each of those consent verifications is a database lookup. If any consent is missing or expired, we have to present consent forms and capture new acknowledgments before proceeding. That's why veterans sometimes feel like they're consenting to the same thing multiple times—technically, they're consenting to different things, but from their perspective, it's 'another form to click through.'
>
> We tried to consolidate consents into a single omnibus form. Legal counsel said no—each consent has different legal basis, different revocation rights, different retention requirements. They can't be combined without creating legal ambiguity. So we're stuck with multiple consent gates, each adding friction to the user journey."

---

### Question 2: Policy Constraints

**"How do policy requirements influence the design and functionality of the system?"**

> "Let me give you the big three that shape almost everything:
>
> **First, identity verification.** VA Directive 6510 requires that we verify veteran identity to a high level of assurance before granting access to health information. That's why we require ID.me or similar identity proofing. We can't just let someone create an account with an email address. We have to verify they are who they claim to be, which means document verification, biometric checks, knowledge-based authentication. It's intrusive and friction-heavy, but it's not optional.
>
> **Second, minimum necessary standard.** HIPAA says we can only collect and display the minimum information necessary for the purpose at hand. That sounds reasonable, but in practice, it creates weird design constraints. We can't show veterans their complete health record on the scheduling screen—even if it would help them choose the right appointment type—because that information isn't 'necessary' for scheduling. So the UI feels fragmented, with information siloed into different sections that can't talk to each other.
>
> **Third, interstate licensing.** Historically, providers could only treat patients in states where they held medical licenses. The VA has special authority under federal supremacy that allows VA providers to practice across state lines, but there are still notification requirements, documentation requirements, and certain limitations. The system has to know where the veteran is physically located at the time of the appointment, which is why we ask for location confirmation even though it seems redundant."

**Follow-up: "Are there specific policy constraints that have posed challenges in the past?"**

> "The Ryan Haight Act has been our biggest ongoing challenge. It's a DEA regulation that, until recently, required an in-person evaluation before prescribing controlled substances via telehealth. For veterans with chronic pain, PTSD, or addiction issues who need medications that fall under this act, telehealth-only care wasn't fully possible.
>
> During COVID, we got emergency flexibilities that suspended some Ryan Haight requirements. Those flexibilities have been partially extended but are still temporary. We're in regulatory limbo—building systems and workflows that might have to change when the flexibilities expire. It's hard to design a good user experience when the underlying rules might shift in six months.
>
> The other challenge is 42 CFR Part 2, which governs substance use disorder records. These records have extra protections beyond regular HIPAA—they can't be shared without specific patient consent, even within VA. So if a veteran is seeing both a primary care provider and an addiction specialist via telehealth, those providers might not be able to see each other's notes without the veteran signing additional consent forms. That creates care fragmentation that's frustrating for everyone."

---

### Question 3: Resource Constraints

**"In terms of resources, what limitations have you encountered when implementing new features or improvements?"**

> "Policy review is a bottleneck, and I'm part of that bottleneck. My team is four people. We review every new feature, every UI change that involves consent or privacy language, every vendor contract, every data sharing agreement. There's a queue, and things wait in the queue.
>
> A feature that engineering could build in two weeks might wait four weeks for policy review. Not because we're slow or lazy—because we're thorough and understaffed. When I rush a review, I miss things. When I miss things, we end up with compliance findings in audits, which creates even more work to remediate.
>
> The other resource constraint is legal counsel availability. For novel questions—things we haven't encountered before—I need OGC (Office of General Counsel) interpretation. OGC serves the entire VA, not just telehealth. Their response time can be weeks or months. So sometimes we have to make conservative design decisions not because we're certain they're required, but because we can't get a definitive answer in time and we err on the side of caution.
>
> Conservative design decisions usually mean more friction for users. 'When in doubt, add a consent gate' is the safe approach but not the user-friendly approach."

**Follow-up: "How do resource constraints impact decision-making processes?"**

> "We end up with a tiered approach. Routine changes—like updating consent language to fix a typo—go through quickly. Moderate changes—like adding a new data field that involves PHI—get standard review. Major changes—like integrating a new vendor or changing how we authenticate users—get full review with legal escalation.
>
> The problem is that 'major' and 'minor' aren't always obvious at the start. Engineering might think a feature is minor, but it has policy implications they didn't anticipate. Then we catch it late in the development cycle, and the choice is: delay launch while we do proper review, or launch with known policy gaps and accept the risk.
>
> Neither option is great. Delays frustrate everyone and waste engineering effort. Launching with gaps creates compliance debt that accumulates. I've seen features ship with 'temporary' consent language that's still in production three years later because no one prioritized fixing it."

---

## Section 2: Processes (Backstage Operations)

### Question 1: Policy Implementation

**"Walk me through how a new policy or compliance requirement is implemented in the VA Telehealth system."**

> "I'll use a real example: implementing the 21st Century Cures Act information blocking provisions. This law required that patients have easy access to their health information and prohibited 'information blocking'—practices that interfere with access.
>
> **Step 1: Interpretation (2-4 months).** The law passed, but what does it mean for VA specifically? We convened working groups with legal, clinical, IT, and privacy stakeholders. We analyzed ONC (Office of the National Coordinator) guidance. We developed our interpretation of what changes were required.
>
> **Step 2: Gap Analysis (1-2 months).** We audited our current systems and processes against the new requirements. Where were we already compliant? Where did we have gaps? We documented 37 specific gaps across our telehealth and patient portal systems.
>
> **Step 3: Remediation Planning (2-3 months).** For each gap, we determined what changes were needed—technical, process, or both. We prioritized based on risk and visibility. We developed implementation timelines.
>
> **Step 4: Implementation (6-18 months).** Engineering built the required changes. Policy team reviewed each change for compliance. Legal signed off on new consent language. We updated training materials for staff.
>
> **Step 5: Verification (ongoing).** We tested the changes, audited for compliance, and monitored for issues. We documented everything for potential OIG review.
>
> Total timeline: about two years from law passage to full implementation. That's actually considered fast for federal government."

**Follow-up: "How are decisions made regarding policy changes and their implementation?"**

> "Prioritization comes down to three factors: legal mandate, risk severity, and leadership visibility.
>
> Legal mandates with hard deadlines come first. If Congress or a regulatory agency says 'do this by this date,' we do it or face sanctions. Those deadlines drive everything else.
>
> Risk severity is next. If a compliance gap could result in harm to veterans, a data breach, or significant legal liability, it gets prioritized even without a mandate.
>
> Leadership visibility is the wildcard. If the Secretary's office or Congress is asking about something, it jumps the queue. That's political reality in government. Sometimes good policy work gets deprioritized because it's not on anyone's radar, while less important things get attention because someone powerful asked about them.
>
> What often gets deprioritized is what I call 'good hygiene'—updating policies that are outdated but not technically wrong, improving consent language for clarity, proactively addressing emerging issues before they become problems. That work competes with fires, and fires always win."

---

### Question 2: Compliance Issue Handling

**"Can you describe the workflow for handling compliance issues within the system?"**

> "Compliance issues come to us through multiple channels: internal audits, OIG reviews, veteran complaints, staff reports, or our own monitoring.
>
> **Triage (24-72 hours).** We assess severity. Is this an active breach? A systemic problem? A one-time error? A misunderstanding? Severity determines response speed and escalation level.
>
> **Investigation (1-4 weeks).** We gather facts. What happened? Who was affected? What systems were involved? We interview stakeholders, review logs, analyze data.
>
> **Determination (1-2 weeks).** Was there an actual compliance violation, or just an appearance of one? If there was a violation, what regulation or policy was violated? How serious is the violation?
>
> **Remediation (varies).** If remediation is needed, we work with the appropriate teams to fix the issue. This might be a technical fix, a process change, additional training, or policy clarification.
>
> **Documentation (ongoing).** Everything gets documented for audit trail purposes. OIG can request our compliance records at any time. If we don't have documentation of how we handled an issue, it's as if we didn't handle it.
>
> **Monitoring (ongoing).** For serious issues, we implement additional monitoring to ensure the problem doesn't recur."

**Follow-up: "Are there specific challenges or bottlenecks in the compliance process that need to be addressed?"**

> "The biggest challenge is what I call 'compliance theater' versus 'actual compliance.'
>
> We have systems that are technically compliant—they check all the boxes, they have all the consent forms, they log everything—but they're not achieving the spirit of the regulation. Veterans click through consent forms without reading them. That's technically informed consent, but is it really?
>
> I raise this concern frequently, and the response is usually: 'We can't force people to read. We've done our part by presenting the information.' That's legally defensible but ethically unsatisfying.
>
> The other bottleneck is cross-system compliance. Our telehealth platform integrates with VistA, with the new Cerner system, with third-party vendors. Each system has its own compliance posture. When data flows between systems, who's responsible for compliance? We've had audit findings where the gap was in the handoff—System A was compliant, System B was compliant, but the data transfer between them wasn't properly secured.
>
> Fixing cross-system issues requires coordination between multiple teams, multiple contracts, sometimes multiple vendors. It's slow and politically fraught. Everyone points fingers at everyone else."

---

## Section 3: Connecting to User Research

**"In our user research, we heard that users reported challenges with appointment scheduling. What policies or technical constraints might be contributing to these challenges?"**

> "Several things come to mind:
>
> **Eligibility verification complexity.** Before a veteran can schedule, we have to verify they're eligible for that specific type of care at that specific facility. Eligibility in VA is notoriously complex—there are priority groups, service-connected conditions, means testing, geographic catchment areas. The scheduling system has to check all of this, and sometimes the rules conflict or are ambiguous. That creates delays and sometimes wrong answers.
>
> **Appointment type restrictions.** Not all care can be delivered via telehealth. Clinical policy determines what's appropriate for video versus phone versus in-person. If a veteran tries to schedule a telehealth appointment for something that requires in-person care—like a physical examination—the system has to catch that and redirect them. But the system isn't always smart about it, so veterans might go through half the scheduling flow before being told 'this care type isn't available via telehealth.'
>
> **Consent currency.** If a veteran's telehealth consent has expired or was never captured, the scheduling system has to branch them into the consent flow before they can complete scheduling. From their perspective, they were booking an appointment and suddenly they're reading legal documents. It feels like a detour, and it is—but it's a legally required detour.
>
> **Interstate complexity.** If a veteran is traveling or has moved, the scheduling system needs to determine whether their provider can legally see them in their current location. For most VA appointments, the answer is yes, but the verification still has to happen, and if there's any question, the system errs on the side of caution and may require additional verification."

---

**"Users mentioned challenges with the onboarding process. How do policy requirements influence the onboarding process, and are there any resource constraints that impact it?"**

> "Onboarding is where every policy requirement hits at once. It's the intake point, so it has to capture everything we need for downstream compliance.
>
> **Identity proofing** is the biggest policy driver. NIST 800-63 guidelines require identity assurance level 2 (IAL2) for access to health information. That means verifiable government ID, knowledge-based authentication, and for higher levels, biometric verification. The ID.me process that veterans complain about isn't arbitrary—it's what NIST says we have to do.
>
> **Consent capture** is the second driver. We have to capture base consents during onboarding so they're in place for subsequent interactions. If we didn't capture consents during onboarding, we'd have to capture them during scheduling, which would make that process even more cumbersome.
>
> **Data collection minimization** creates an interesting tension. HIPAA says collect only what's necessary, but our clinical and operational teams have long lists of 'necessary' information. The onboarding process is a negotiated compromise between privacy (collect less) and operational needs (collect more). Neither side is fully happy.
>
> **Resource constraints** impact onboarding support. When veterans get stuck—and many do, especially with ID.me—they call the help desk. The help desk is overwhelmed. Wait times are long. Veterans give up. That's not a policy failure per se, but it's a resource failure that makes policy compliance feel punitive.
>
> The policy team has recommended simplified onboarding paths for veterans who struggle with digital identity verification—like in-person proofing at VA facilities. But implementing that requires staff resources that facilities say they don't have. So the recommendation sits in a report that no one acts on."

---

## Closing

**"What haven't I asked about that you think I should know?"**

> "Two things.
>
> **First, the tension between privacy and usability is real and underappreciated.** I attend meetings where designers propose features that would be great for veterans but create privacy risks. I have to be the one who says 'we can't do that' or 'we can only do that with significant guardrails.' I know I'm seen as an obstacle. But when there's a breach or an audit finding, the same people who wanted to move fast are nowhere to be found. Compliance becomes very important when things go wrong.
>
> I wish there were more investment in privacy-by-design—building privacy in from the start rather than bolting it on at the end. When I'm involved early, I can usually find ways to meet both user needs and compliance requirements. When I'm brought in at the end to 'approve' something, my options are limited.
>
> **Second, regulatory uncertainty is constant.** The rules are always changing. HIPAA enforcement priorities shift with administrations. New state laws create patchwork requirements. Court decisions reinterpret existing regulations. What's compliant today might not be compliant next year.
>
> We can't design for a static regulatory environment because there isn't one. So we build conservatively, knowing we might have to tighten controls later. That conservatism adds friction for veterans, but it's better than building something permissive and having to restrict it later—that creates even worse user experience."

---

**"Who else should I talk to about policy and compliance within the VA Telehealth system?"**

> "You should definitely talk to Carlos Medina in our Privacy Office. He handles breach response and privacy complaints. He can tell you what goes wrong when compliance fails—the real-world consequences of the gaps in our systems.
>
> I'd also recommend Stephanie Park in the Office of General Counsel. She does our legal interpretations. She can explain why certain policies are the way they are from a legal doctrine perspective, not just an operational one.
>
> And if you can get access to it, talk to someone from the OIG's Office of Healthcare Inspections. They audit us. They see patterns across the whole VA, not just telehealth. They have insights into systemic issues that individual teams might miss.
>
> Finally, and this might be unusual, talk to a veteran who's been through the process and also understands the policy side—there are some on our advisory committees. They can articulate the user frustration in policy-relevant terms. They feel the friction and understand why it exists, which gives them a unique perspective on what friction is tolerable versus what's excessive."

---

**"Can I follow up if I have more questions?"**

> "Absolutely. I'm at denise.whitfield@va.gov. I'm happy to review any findings that have policy implications. In fact, I'd appreciate it—I sometimes learn about user experience issues through your research that we should address from a policy perspective.
>
> One thing: if your research identifies situations where veterans are confused about consent or privacy, please flag those explicitly. Consent that doesn't create understanding isn't really consent. If we're failing at that, I need to know so I can push for changes. It's ammunition for the work I'm already trying to do."

---

## Post-Interview Notes

### Key Constraints Identified

1. **Audit Logging Overhead**: HIPAA-required logging creates performance issues at VA's scale (billions of entries)
2. **Multiple Consent Gates**: Different legal bases prevent consolidation; veterans experience as repetitive
3. **Identity Verification (IAL2)**: NIST 800-63 requirements drive ID.me friction; not optional
4. **42 CFR Part 2**: Substance use records require separate consent even within VA, fragmenting care
5. **Ryan Haight Act Uncertainty**: DEA controlled substance rules in regulatory limbo post-COVID flexibilities

### Surprising Insights

- "Compliance theater" concern: Technical compliance ≠ actual informed consent (4-second read times)
- Policy team is 4 people reviewing all telehealth features, contracts, and data agreements
- OGC (legal counsel) response time can be weeks to months, forcing "conservative" (high-friction) defaults
- Simplified onboarding recommendations exist but aren't implemented due to resource constraints
- Cross-system compliance gaps fall through cracks—"everyone points fingers"

### Connections to User Research

| User Finding | Policy Context |
|--------------|----------------|
| Appointment scheduling challenges | Eligibility complexity, consent currency checks, interstate verification requirements |
| Onboarding friction | NIST IAL2 identity proofing requirements; consent capture front-loaded by policy design |
| Multiple consent forms | Different legal bases, revocation rights, retention requirements prevent consolidation |
| Feeling of "clicking through" | Known issue—technically compliant but ethically unsatisfying; policy team shares concern |

### Follow-up Questions

1. What would privacy-by-design involvement look like earlier in the development process?
2. Can we see the simplified onboarding recommendations that haven't been implemented?
3. How does the policy team prioritize feature reviews in the queue?
4. What's the current status of Ryan Haight Act flexibility extensions?

### Recommended Additional Interviews

| Name | Role | Focus Area |
|------|------|------------|
| Carlos Medina | Privacy Office | Breach response, privacy complaints, failure consequences |
| Stephanie Park | Office of General Counsel | Legal doctrine, regulatory interpretation |
| OIG Healthcare Inspections | Office of Inspector General | Audit patterns, systemic issues |
| Veteran Advisory Committee Member | Patient Advocate | Policy-informed user perspective |

---

*Interview documented by Jordan (UX Researcher)*  
*Qori-generated guide used • January 21, 2026*
