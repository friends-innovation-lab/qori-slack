# 📋 Stakeholder Interview Response

> **Study:** VA Health and Benefits Mobile App  
> **Stakeholder:** Evelyn Tran, Senior Privacy Counsel & Policy SME  
> **Date:** January 26, 2026  
> **Duration:** 52 minutes  
> **Interviewer:** Research Team

---

## Participant Profile

| | |
|---|---|
| **Name** | Evelyn Tran, JD, CIPP/US, CIPP/G |
| **Role** | Senior Privacy Counsel, VA Office of General Counsel; Mobile Platform Policy SME |
| **Tenure** | 8 years at VA, 16 years in federal privacy law |
| **Certifications** | Certified Information Privacy Professional (US & Government) |
| **Primary Focus** | Mobile app privacy compliance, data governance, consent management, HIPAA/Privacy Act interpretation |

---

## Opening Context

**"Can you tell me about your role and how you interact with the VA mobile app team?"**

> "I'm senior privacy counsel in VA's Office of General Counsel, and I've been designated as the primary legal advisor for the mobile app platform. That means every feature that touches veteran data—which is essentially every feature—comes through my review at some point.
>
> My role is to ensure the mobile app complies with the Privacy Act of 1974, HIPAA, the VA's internal privacy policies, and various other regulations that govern how we collect, use, store, and share veteran information. On mobile, there are additional considerations—device security, app store requirements, biometric data handling—that make it more complex than web.
>
> I work closely with the product and engineering teams during feature development. They don't love seeing my name on their meeting invites—I usually bring constraints, not solutions. But I try to be a collaborative partner. My job isn't to say 'no.' It's to say 'here's how to do this in a way that protects veterans and keeps VA out of legal trouble.'
>
> I also interface with external regulators. When OIG audits mobile app practices, I'm the one answering questions. When Congress asks about veteran data privacy, I'm drafting talking points. That accountability focus shapes how I approach reviews—every decision needs to be defensible."

---

## Section 1: Policy Constraints Affecting Mobile

### Question 1: Core Privacy Requirements

**"What policy or compliance requirements most impact mobile product decisions?"**

> "Let me give you the foundational legal framework, because everything flows from this:
>
> **The Privacy Act of 1974** governs all federal records containing personally identifiable information. Any data we collect must have a published System of Records Notice (SORN) that explains what we collect and why. We can't collect data 'just because it might be useful'—there has to be a documented purpose. On mobile, this limits telemetry and analytics. We can't track user behavior the way commercial apps do.
>
> **HIPAA** applies to all health information. The mobile app displays health records, appointment data, prescription information—all protected health information (PHI). HIPAA requires technical safeguards (encryption), administrative safeguards (access controls), and physical safeguards (device security). HIPAA also restricts how we can use PHI for app improvement—we can't data-mine health records to optimize features without explicit consent.
>
> **VA Directive 6502** is our internal privacy policy, which is actually stricter than HIPAA in some ways. It requires privacy impact assessments for any new data collection, limits data retention, and mandates privacy training for anyone with data access.
>
> **NIST 800-63** governs digital identity. This is why the authentication experience is what it is. We're required to achieve Identity Assurance Level 2 (IAL2) for health information access, which means verified government ID, not just email and password."

**Follow-up: "How do these requirements change feature designs?"**

> "Every feature goes through a privacy lens that asks:
>
> 1. **What data is being collected or displayed?** If it's PII or PHI, we need to ensure proper authorization.
> 2. **Is the veteran aware?** Transparency is paramount. Veterans must understand what data the app accesses.
> 3. **Is it necessary?** Minimum necessary standard—we should only access the data needed for the specific function.
> 4. **How is it protected?** Encryption at rest and in transit, access logging, session management.
> 5. **What if the device is compromised?** We design assuming the phone could be lost, stolen, or accessed by someone other than the veteran.
>
> Let me give a concrete example. The team wanted to implement **smart notifications**—personalized alerts based on veteran health data. 'Your A1C is due for checking' or 'You haven't refilled your blood pressure medication.' Great for health outcomes, but legally complex.
>
> To send health-related notifications, we'd be using PHI to make decisions about what to send. That requires explicit authorization beyond general app consent. We'd need to document the data use in our SORN. We'd need to ensure the notification content doesn't expose PHI if someone else sees the veteran's phone.
>
> The team was frustrated—this seems obvious and beneficial. But 'beneficial' doesn't equal 'legal.' We ended up with a much more limited notification system that doesn't use health data for triggering, only for display after the veteran opens the app."

---

### Question 2: Mobile-Specific Privacy Challenges

**"What privacy challenges are unique to mobile versus web?"**

> "Mobile introduces privacy vectors that don't exist on web:
>
> **Biometric data** is the biggest one. We use Face ID and fingerprint for authentication. Biometric data is extraordinarily sensitive—it's not like a password you can change. Fortunately, Apple and Google handle biometric storage on-device; we never see the actual biometric data, just a yes/no authentication result. But we still had to document this extensively to ensure we weren't inadvertently collecting biometrics.
>
> **Location data** is another concern. The app has optional location features—like finding the nearest VA facility. Even optional collection requires Privacy Act documentation. And location data combined with health data creates a very sensitive profile. We could theoretically know that a veteran visited a mental health clinic. That's information that must be protected rigorously.
>
> **Push notifications** create an externalization risk. Notifications appear on the lock screen, in notification centers, potentially synced to other devices. Any notification content is potentially visible to someone other than the veteran. We've taken an extremely conservative position: no PHI in notification content, ever.
>
> **Device sharing** is common. A veteran might share a phone with a spouse, let a child borrow it, hand it to a caregiver. The app can't assume that whoever's holding the device is the authenticated veteran. This is why we require biometric or PIN re-authentication rather than keeping sessions active indefinitely.
>
> **App store analytics** are another consideration. Apple and Google collect crash reports, usage data, performance metrics from apps. We've configured our app to minimize what's shared with platforms, but we can't fully control it. Veterans should know that downloading a VA app creates some data relationship with Apple or Google."

---

### Question 3: Authentication Requirements

**"Can you explain the authentication requirements and why they're so rigorous?"**

> "The authentication requirements come from multiple sources, all pointing in the same direction: high assurance.
>
> **NIST 800-63** establishes identity assurance levels. For accessing health records (PHI), we need IAL2—identity proofing that verifies the person is who they claim to be. That means checking government-issued ID, verifying the ID is genuine, and matching the person to the ID. It's intrusive, but it's the federal standard for health information.
>
> **VA Directive 6510** adds VA-specific requirements on top of NIST. Multi-factor authentication is required for any PHI access—something you know (password) plus something you have (phone/token) or something you are (biometric).
>
> **Why so rigorous?** Because the consequences of unauthorized access are severe. If someone accesses another veteran's health records, that's a privacy breach reportable to Congress. If someone files a fraudulent benefits claim using another veteran's identity, that's fraud and identity theft. We're protecting both veterans and taxpayers.
>
> The authentication experience—ID.me or Login.gov—is painful. I know. Veterans complain. But the alternatives are worse:
>
> - **Weaker authentication** would increase fraud and privacy breaches.
> - **VA-built authentication** would be even less usable and massively expensive.
> - **No mobile access** would exclude veterans who rely on mobile.
>
> We've chosen the least bad option. It's not great, but it's legally sound and adequately secure."

**Follow-up: "Why can't there be a 'light' mode with less data and less authentication?"**

> "We explored this. The idea was: let veterans access some information (appointment times, facility locations) with lighter authentication, and require full verification only for sensitive data.
>
> The problem is defining what's 'sensitive.' Is an appointment time sensitive? It could reveal that a veteran is seeing a psychiatrist. Is a facility location sensitive? It could reveal they're receiving care for a stigmatized condition.
>
> The minimum necessary principle creates a clean line: PHI requires full authentication. Once you start creating tiers—this PHI is okay with light auth, this PHI isn't—you create complexity, edge cases, and potential for error.
>
> There's also a practical concern. If we offer light-auth access to some features, veterans will expect to use those features without friction. When they then need to upgrade to full auth for other features, the experience is jarring. 'I was just using the app! Why do I need to verify my ID now?'
>
> The team has proposed this multiple times. Each time, legal review concludes the risks outweigh benefits. I understand the frustration, but the current approach is the defensible one."

---

## Section 2: Approval and Compliance Processes

### Question 1: Feature Approval Process

**"Walk me through the privacy review process for new mobile features."**

> "Every new feature that involves veteran data goes through **Privacy Threshold Analysis (PTA)**. This is a questionnaire that captures what data is involved, how it's collected, stored, shared, and protected. I review every PTA for the mobile app.
>
> If the PTA reveals new data collection or significant changes to existing data use, we escalate to a **Privacy Impact Assessment (PIA)**. A PIA is a more thorough analysis, publicly published, that documents our privacy practices. The mobile app has a PIA that gets updated when significant features are added.
>
> For features involving health data specifically, there's an additional **HIPAA Security Rule assessment**. This evaluates whether the technical safeguards—encryption, access controls, audit logging—are adequate.
>
> My review typically takes 2-3 weeks for straightforward features, 6-8 weeks for complex ones involving new data types or sharing arrangements. I know that's frustrating for a team trying to ship quickly, but thoroughness matters. A privacy finding from OIG takes a lot longer than 6 weeks to remediate.
>
> **Approval criteria** are:
>
> 1. Documented purpose for data collection
> 2. Minimum necessary data scoping
> 3. Appropriate technical safeguards
> 4. Veteran transparency (they know what's happening)
> 5. Defensible legal basis
>
> If a feature meets these criteria, I approve. If not, I work with the team to modify until it does."

**Follow-up: "Where do features typically get stuck or modified?"**

> "**Analytics and telemetry** cause the most friction. Product teams want to understand user behavior—where veterans tap, how long they spend on screens, where they abandon flows. This is normal product practice in the private sector.
>
> In the federal privacy context, behavioral tracking is scrutinized. We can collect aggregated analytics (how many veterans used this feature) but are limited in individual-level tracking (this veteran did X, then Y, then Z). The distinction matters legally, but it limits the product team's ability to diagnose individual user problems.
>
> **Third-party integrations** also get stuck. Any external service that receives veteran data needs privacy and security vetting. The team once wanted to integrate a third-party accessibility testing tool that would see UI content during development. Even though it's a development tool, it would potentially see PHI in screenshots. We had to ensure the vendor met federal security requirements before approving.
>
> **Data retention** requests get modified. Teams want to keep data 'in case it's useful.' Privacy law requires defined retention periods with documented destruction. If we can't articulate why data needs to exist, it shouldn't exist."

---

### Question 2: Handling Privacy Incidents

**"What happens when there's a privacy incident involving the mobile app?"**

> "We have a documented **Incident Response Plan** that kicks in when potential privacy incidents are detected.
>
> **Detection** comes from multiple sources: automated alerts for unusual access patterns, help desk reports from veterans, internal staff reports, or external notification (someone finds a vulnerability).
>
> **Assessment** determines severity. Did unauthorized access occur? What data was involved? How many veterans affected? Is there ongoing risk?
>
> **Containment** stops the bleeding. If there's an app vulnerability, we might push an emergency update, disable a feature, or in extreme cases, pull the app from stores temporarily.
>
> **Notification** is legally required in certain scenarios. HIPAA requires breach notification for unauthorized PHI access. The Privacy Act requires breach notification for PII. VA policy requires Congressional notification for incidents affecting large numbers of veterans. This notification burden makes us very conservative—we'd rather prevent incidents than manage their aftermath.
>
> **Remediation** fixes the root cause and improves processes.
>
> We've had minor incidents—a bug that briefly showed the wrong veteran's appointment (caught in testing, never reached production), a crash log that inadvertently contained PHI (caught by our analytics review process). Each one triggered a formal review. No major breaches, which I attribute to our conservative approach.
>
> The **mobile-specific risk** is device-level compromise. If a veteran's phone is stolen and the thief gains access to the app, that's a privacy incident. We've designed safeguards—session timeout, biometric required for re-entry, no PHI cached beyond session—to limit damage. But we can't fully protect against determined adversaries with physical device access."

---

## Section 3: Resource and Strategic Considerations

### Question 1: Legal Team Capacity

**"How do resource constraints affect your ability to support the mobile team?"**

> "I'm one of a handful of privacy counsel serving all of VA. The mobile app is one of many products that need legal review. My bandwidth is limited.
>
> I try to prioritize mobile because of its user base and risk profile. But during busy periods—when Congress is asking questions, when audits are happening, when policy is being rewritten—mobile reviews can slip.
>
> The team has learned to engage me early. If they tell me about a feature six months before launch, I can fit review into my schedule. If they come to me a month before launch needing sign-off, we have a problem.
>
> I've advocated for dedicated legal support for digital products. The answer is always 'resource constraints.' So we make do with the coverage we have.
>
> **Template approvals** help. For features that follow established patterns—standard data display, standard authentication, standard logging—I've created pre-approved approaches. If the team follows the template, they don't need case-by-case review. That's reduced my workload significantly for routine features. Novel features still require full review."

---

### Question 2: Balancing Privacy vs. Usability

**"How do you think about the balance between privacy protection and user experience?"**

> "This is the core tension of my role. Everything I do creates user friction. Authentication requirements create friction. Session timeouts create friction. Limited notifications create friction. The privacy-protective design is the friction-heavy design.
>
> I try to find the minimum privacy-protective approach—not gold-plated paranoia, but adequate protection. When there are multiple compliant options, I recommend the one with least friction.
>
> But I won't compromise on fundamentals. If the choice is 'slightly better UX' versus 'legally defensible,' legally defensible wins. My job is risk management. A privacy breach affects millions of veterans and costs tens of millions of dollars to remediate. No UX improvement is worth that risk.
>
> That said, I'm sympathetic to the team's frustrations. I use the VA mobile app myself. The authentication is annoying. The session timeouts interrupt my flow. I experience the friction I create.
>
> What I tell the team is: **advocate for better privacy technology.** The authentication experience is bad because identity proofing technology is immature. If ID.me or Login.gov improve their mobile experience, everyone benefits. Push them, lobby them, give feedback. I can't lower the legal bar, but I can support efforts to meet that bar more gracefully."

---

### Question 3: Future Policy Considerations

**"Are there policy changes on the horizon that might affect mobile?"**

> "Several areas are evolving:
>
> **Digital identity modernization** is a priority for the federal government. There's acknowledgment that current identity proofing is too cumbersome. Efforts to create smoother verification paths—like 'digital wallets' with reusable verified credentials—could dramatically improve mobile onboarding. We're watching this closely but aren't early adopters.
>
> **Health information exchange** is expanding. The VA is increasingly sharing data with community providers, which affects what veterans can see about their care via the app. More data exchange means more complexity in ensuring veterans see a complete, accurate picture.
>
> **Artificial intelligence** governance is emerging. If the mobile app uses AI—for chatbots, predictive features, personalization—there's increasing scrutiny of how AI makes decisions about veterans. We'll need transparency about AI use and safeguards against bias.
>
> **State privacy laws** are a complicating factor. California, Virginia, Colorado, and others have passed privacy laws. As a federal agency, we're generally not subject to state law, but we try to align with best practices. If state laws create expectations among veterans (like 'I should be able to delete my data'), we need to manage those expectations.
>
> The policy environment is getting more complex, not simpler. The mobile team should expect more compliance considerations over time, not fewer."

---

## Section 4: Connecting to User Research

**"Users report frustration with the login process. From your legal perspective, what would it take to simplify it?"**

> "Short answer: we need better identity technology, not lower legal standards.
>
> The login frustration stems from identity proofing—verifying you are who you claim to be. The legal requirement (IAL2) isn't going away. The implementation could improve.
>
> **Passwordless authentication** is one area where we could reduce friction without reducing security. If veterans could use device biometrics as their primary authentication—not just for 'remember me' but for initial login—that would be faster. The technology exists. The policy interpretation is evolving to allow it.
>
> **Credential reuse** is another opportunity. If a veteran has already verified their identity with Login.gov for another purpose, why verify again for VA? This is the 'digital wallet' concept—prove once, use everywhere. It requires infrastructure that doesn't fully exist yet.
>
> **Delegated access** is the most-requested feature we can't easily provide. If a veteran could authorize their spouse to access on their behalf, that would solve many complaints. But delegation requires a whole framework—who can delegate, what can be delegated, how to revoke, how to audit. It's technically and legally complex. VHA is developing a delegation system for health care, but it's years from being app-ready.
>
> I can't make login easier within current constraints. I can advocate for better constraints."

---

**"Users want to share data with family members or caregivers. What's the legal barrier?"**

> "Family sharing touches core privacy principles.
>
> Veterans have a right to **privacy of their health information**, even from family. A veteran might not want their spouse to know about a mental health diagnosis. Adult children might not need to know their veteran parent's full medical history. The default must be no sharing, with sharing requiring explicit authorization.
>
> **Authorization mechanisms** must be robust. If sharing were easy to enable, it might also be easy to enable coercively. An abusive family member could pressure a veteran to share access. We need verification that sharing requests are truly voluntary.
>
> **Scope limitations** are necessary. A veteran might want their caregiver to schedule appointments but not view mental health records. Granular sharing controls are complex to design and audit.
>
> **Revocation** must be straightforward. If a veteran grants access and later wants to revoke it (divorce, family conflict, caregiver change), that must be easy and immediate.
>
> The caregiver delegation program in development addresses this, but carefully. It's been in development for years because getting it right is hard. Doing it wrong would create privacy violations or, worse, enable exploitation of vulnerable veterans.
>
> Until the formal delegation system is ready, the app can't offer sharing. That frustrates veterans with benign sharing needs, but it protects veterans who might be harmed by premature implementation."

---

**"Users are confused about what data the app can see about them. How do we communicate privacy better?"**

> "Transparency is a legal requirement, but current transparency mechanisms don't work well.
>
> **Privacy notices** are legally mandated and largely ignored. We provide them because we must. They're written in legal language because that's what compliance requires. We've tried plain-language summaries, but legal is uncomfortable with summaries that might be incomplete or misleading.
>
> **In-context disclosure** is better. When the app accesses specific data, explaining what and why at that moment is more meaningful than a front-loaded privacy notice. We've implemented some of this—when you grant location permission, we explain what it's used for.
>
> **Privacy dashboards** are a potential improvement—a place in the app where veterans can see what data the app has accessed, when, and for what purpose. This is something the team has proposed. I support it conceptually; implementation would need careful design.
>
> The honest challenge is that privacy is complicated, and simplifying it risks inaccuracy. If we say 'we only use your data to show you your information,' that's not quite true—we also use data for analytics, fraud detection, service improvement. But listing every use is overwhelming. It's a communication design problem without a perfect solution."

---

## Closing

**"What constraint or challenge haven't I asked about that significantly impacts policy decisions?"**

> "**Audit and accountability pressure.** Everything we build is potentially subject to Congressional inquiry, OIG audit, or media scrutiny. This creates conservatism.
>
> When I make a policy judgment call—'this approach is adequate but not perfect'—I'm betting that if audited, I can defend that call. If I'm wrong, it's not just embarrassment; it's potential findings, required remediation, and leadership explaining to Congress why we didn't do better.
>
> This accountability is appropriate. Federal agencies should be scrutinized. But it creates asymmetric incentives. The cost of approving something that later causes problems is high. The cost of blocking something that might have helped veterans is low (I'll never be audited for features we didn't build).
>
> I try to be aware of this bias and push back on my own conservatism. But the structural incentive remains: caution is rewarded, risk-taking is punished."

---

**"Who else should I talk to to better understand policy constraints?"**

> "**Michael Okonkwo** is the VA Chief Privacy Officer. He sets enterprise policy that I implement. He can explain why certain VA policies are stricter than baseline HIPAA.
>
> **The Login.gov and ID.me teams** could explain their constraints. They're implementing federal identity standards and have their own limitations. Understanding their roadmap would help the mobile team plan.
>
> **OCTO privacy lead** (currently Samantha Reyes) bridges technical and policy. She translates privacy requirements into technical specifications and can explain the implementation side of what I approve on paper.
>
> **Veteran advocates** would give you perspective on privacy expectations. What do veterans actually want? Where would they accept risk for convenience? That input should inform how we balance privacy and usability."

---

**"Can I follow up if I have questions?"**

> "Yes. evelyn.tran@va.gov. I'm also on the VA policy Slack channel if you have quick questions.
>
> If your research uncovers privacy concerns veterans have—things they don't understand, things that worry them, things they wish they could do with their data—I want to know. User expectations are part of how we calibrate our approach. If veterans expect something we can't provide, we need to either explain why or reconsider whether we should provide it."

---

## Post-Interview Notes

### Key Constraints Identified

1. **Privacy Act + HIPAA Dual Compliance**: Federal records law plus health privacy law; stricter than commercial standards
2. **IAL2 Identity Assurance (NIST 800-63)**: Verified government ID required; can't lower for mobile convenience
3. **Minimum Necessary Standard**: Can't collect data "in case useful"; every field needs documented purpose
4. **No PHI in Notifications**: Lock screen visibility risk means all notifications are vague
5. **No Family/Caregiver Sharing**: Delegation framework years away; can't implement without abuse safeguards
6. **2-8 Week Privacy Review**: Thorough but time-consuming; team must engage early

### Surprising Insights

- "Smart notifications" (health-triggered alerts) were rejected despite health benefits—PHI use requires special authorization
- Behavioral analytics severely limited; can't track individual user journeys like commercial apps
- Legal has created "template approvals" for standard patterns to reduce review burden
- Accountability asymmetry: blocking features has no cost; approving risky features has high cost
- Biometric data from Face ID/Touch ID never actually reaches VA—only yes/no authentication result

### Connections to User Research

| User Finding | Legal/Policy Context |
|--------------|----------------------|
| Login frustration | IAL2 legally required; improvement requires better identity tech, not lower standards |
| Want family sharing | Delegation framework in development; blocked by abuse risk, revocation complexity |
| Notifications unhelpful | PHI can't appear in notifications; legal won't approve preview content |
| Privacy confusion | Legal notices are verbose by requirement; plain language summaries risk inaccuracy |

### Follow-up Questions

1. What's the realistic timeline for delegated/caregiver access?
2. Could a "privacy dashboard" showing data access be approved?
3. What would passwordless primary authentication require policy-wise?
4. How are state privacy laws being monitored for veteran expectation impact?

### Recommended Additional Interviews

| Name | Role | Focus Area |
|------|------|------------|
| Michael Okonkwo | VA Chief Privacy Officer | Enterprise privacy policy rationale |
| Login.gov/ID.me product teams | Identity vendors | Authentication roadmap and constraints |
| Samantha Reyes | OCTO Privacy Lead | Technical implementation of privacy requirements |
| Veteran advocates | VSOs, patient advocates | Privacy expectations and trade-off preferences |

---

*Interview documented by Research Team*  
*Qori-generated guide used • January 26, 2026*
