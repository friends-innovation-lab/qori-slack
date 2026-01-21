# 📋 Stakeholder Interview Response

> **Study:** VA Telehealth Onboarding and Appointment  
> **Stakeholder:** Marcus Chen, Engineering Lead  
> **Date:** January 21, 2026  
> **Duration:** 52 minutes  
> **Interviewer:** Jordan (UX Researcher)

---

## Participant Profile

| | |
|---|---|
| **Name** | Marcus Chen |
| **Role** | Engineering Lead, VA Digital Services |
| **Tenure** | 4 years at VA, 12 years in healthcare tech |
| **Team Size** | 8 engineers (4 backend, 3 frontend, 1 DevOps) |
| **Primary Systems** | Telehealth scheduling API, Patient portal integration, Video conferencing bridge |

---

## Opening Context

**"Can you tell me about your role and how you interact with the VA Telehealth Onboarding and Appointment system?"**

> "Sure. I lead the engineering team responsible for the technical backbone of the telehealth appointment system. We handle everything from the scheduling APIs to the video conferencing integration. My day-to-day involves a lot of coordination—making sure our systems talk properly to the legacy VistA databases, managing the integration with our third-party video providers, and honestly, a lot of troubleshooting when things don't connect the way they should.
>
> I interact with the system at every layer. When a veteran schedules a telehealth appointment, my team's code handles the request, validates eligibility, checks provider availability, creates the appointment record, and then provisions the video room. We also maintain the notification system that sends reminders and the patient-facing portal components."

---

## Section 1: Constraints (Technical, Policy, Resource)

### Question 1: Technical Constraints

**"What are the biggest technical constraints affecting the system's performance?"**

> "The elephant in the room is VistA. It's a 40-year-old system that we absolutely cannot replace overnight—it's the source of truth for everything. Every appointment, every patient record, every provider schedule ultimately lives in VistA. The constraint isn't just that it's old; it's that we have to maintain compatibility with literally decades of accumulated data formats and business logic.
>
> We're essentially building modern microservices that have to translate everything to and from VistA's M/MUMPS language. Every API call adds latency because of that translation layer. On a good day, appointment creation takes 3-4 seconds. On a bad day—when VistA is under heavy load during Monday morning scheduling rushes—it can take 15-20 seconds, and sometimes just times out entirely."

**Follow-up: "Can you provide examples of how these constraints impact the user experience?"**

> "Veterans see it as the 'spinning wheel of frustration.' They click to schedule an appointment, and they're just... waiting. No feedback, no progress indicator that actually means anything because we can't predict VistA's response time. 
>
> The worst is when they fill out the entire intake form, hit submit, and get a timeout error. The appointment might have actually been created in VistA, but our system never got the confirmation back. Now we have potential duplicates, confused veterans calling the help desk, and schedulers manually checking records. Last month alone, we had 847 duplicate appointment incidents."

**Follow-up: "How do these constraints influence decision-making in the engineering process?"**

> "We've essentially adopted a 'VistA-first' architecture philosophy. Before we design any new feature, the first question is always: 'How does this interact with VistA?' We've had to kill several good ideas because the VistA integration would be too fragile or too slow.
>
> For example, we wanted to implement real-time provider availability—showing veterans which time slots are actually open as they're browsing. Technically trivial in a modern system. But querying VistA for real-time availability across multiple providers would bring the system to its knees. So instead, we sync availability every 15 minutes and hope nothing changes between when a veteran picks a slot and when they confirm."

---

### Question 2: Policy Constraints

**"How do policy constraints influence the development and implementation of new features?"**

> "FedRAMP and FISMA compliance are always in the background. We can't just spin up a new cloud service or integrate a cool new tool without going through the ATO (Authority to Operate) process. That's typically 6-9 months minimum. 
>
> The video conferencing situation is a perfect example. We'd love to use Zoom or Teams—veterans are familiar with them, they work on any device. But getting those platforms authorized for VA use with PHI (Protected Health Information) is a massive undertaking. We're currently using a FedRAMP-authorized solution that frankly isn't as user-friendly, and we hear about it constantly from both veterans and providers."

**Follow-up: "Are there specific policies that have posed challenges in the past?"**

> "The consent and authentication requirements are brutal from a UX perspective. VA policy requires multi-factor authentication for any PHI access. Makes sense for security, but it means veterans need to go through ID.me verification, then VA.gov login, often with a hardware token or phone-based MFA. 
>
> We've had veterans—especially older ones—abandon the onboarding process because they couldn't get through authentication. Our analytics show a 34% drop-off rate at the MFA step. Policy says we can't reduce that friction, so we're stuck trying to make a fundamentally frustrating process marginally less frustrating."

**Follow-up: "How do you navigate policy constraints while aiming to meet user needs?"**

> "Honestly? It's a lot of creative workarounds. We've implemented 'proxy scheduling' where a family member or caregiver can schedule on behalf of a veteran—but that required 18 months of policy negotiation to get approved. 
>
> We also do a lot of 'pre-warming.' Before a veteran even starts onboarding, we try to verify their identity through other VA touchpoints so when they hit our system, we can offer a streamlined path. It's not technically reducing the security requirements—we're just front-loading the friction to a different moment."

---

### Question 3: Resource Constraints

**"What resource constraints have the most significant impact on project timelines and deliverables?"**

> "Talent, full stop. Finding engineers who understand both modern cloud development AND legacy government systems is incredibly difficult. The private sector pays 40-60% more, and they don't ask you to understand MUMPS. I've had two senior engineers leave in the past year for private healthcare tech companies.
>
> The other constraint is budget cycles. Federal funding is annual, and we have to obligate funds within the fiscal year. That creates this bizarre rhythm where Q4 is a mad rush to spend allocated budget on things we may not even need yet, and Q1 we're often frozen waiting for the new appropriation. Long-term projects suffer because we can't plan beyond the current fiscal year with any certainty."

**Follow-up: "How do resource limitations affect prioritization of tasks?"**

> "Everything becomes triage. We have a backlog of about 200 enhancement requests, and we can realistically tackle maybe 30 per year. So we're constantly asking: 'What's on fire? What's a regulatory requirement? What did Congress or the Secretary's office specifically ask for?' 
>
> User experience improvements, unfortunately, often get deprioritized unless they're tied to a specific mandate or a public embarrassment. The timeout issue I mentioned? It's been on our backlog for three years. We know exactly how to fix it technically, but it requires a significant VistA modification that competes with other priorities."

**Follow-up: "Have resource constraints led to trade-offs in feature development?"**

> "Constantly. The mobile app is a great example. We designed a beautiful native experience with offline functionality, biometric login, the works. What shipped was a responsive web wrapper with limited features because we didn't have the iOS/Android developers to build and maintain native apps.
>
> Same with accessibility. We know we have WCAG compliance gaps. We've documented them. We have remediation plans. But fixing accessibility issues competes with the same pool of developer hours as new features, security patches, and keeping the lights on. It's not that we don't care—it's that we literally cannot do everything with the people we have."

---

## Section 2: Backstage Operations

### Question 1: Process Flow

**"Walk me through how a typical task or process moves through the system's backstage operations."**

> "Let me walk you through what happens when a veteran schedules a telehealth appointment. Keep in mind, this is the 'happy path'—reality is messier.
>
> 1. **Request Initiation**: Veteran clicks 'Schedule Appointment' on VA.gov. Request hits our API gateway.
>
> 2. **Eligibility Check**: We query VistA to confirm the veteran is enrolled, has telehealth consent on file, and is eligible for the requested service type. This alone can be 3-5 API calls to different VistA endpoints.
>
> 3. **Provider Matching**: Based on the veteran's registered facility and the service type, we pull available providers. If they have an existing care relationship, we try to match them with that provider first.
>
> 4. **Slot Availability**: We check our cached availability data (remember, synced every 15 minutes). If the slot appears open, we proceed. If not, we surface alternatives.
>
> 5. **Appointment Creation**: We send the appointment request to VistA. This is the scary moment—we're committing to creating a record in a system we don't control.
>
> 6. **Video Room Provisioning**: Once VistA confirms, we trigger our video platform API to create a unique meeting room and generate join links.
>
> 7. **Notification Dispatch**: Confirmation emails/texts go out to the veteran, plus we update the provider's schedule view.
>
> 8. **Audit Logging**: Everything gets logged for compliance—who did what, when, from where.
>
> Total elapsed time: 8-30 seconds, depending on VistA mood."

**Follow-up: "Are there any bottlenecks or inefficiencies in this process?"**

> "The VistA calls are the obvious bottleneck. But honestly, the notification system is also problematic. We're using three different notification channels—email through a VA-wide service, SMS through a separate contract, and push notifications through our app. They're not well-coordinated. Veterans sometimes get the text before the email, or vice versa, with slightly different information because the templates aren't synchronized. It's confusing.
>
> The other inefficiency is error handling. When something fails mid-process, we don't have good rollback mechanisms. If VistA creates the appointment but the video room provisioning fails, we have to detect that asynchronously and either retry or alert a human operator. There's a queue of 'orphaned appointments' that gets manually reviewed every day. It's a band-aid."

**Follow-up: "How do you ensure smooth coordination between different teams involved in backstage operations?"**

> "Lots of meetings, honestly. We have a daily standup that includes engineering, operations, and our VistA liaison. Weekly we meet with the video platform vendor and the notification services team. Monthly we have a 'system health' review with leadership.
>
> We also have a shared incident channel in Slack where anyone can flag issues in real-time. That's actually been the most effective coordination tool. When something breaks, everyone sees it immediately and can swarm on it.
>
> What we don't have—and desperately need—is unified monitoring. Each component has its own dashboards and alerting. I have to check four different systems to understand if the end-to-end experience is healthy. That's a project I keep proposing but can't get prioritized."

---

### Question 2: Decision-Making in Operations

**"How are decisions made regarding system updates, maintenance, and improvements in the backstage operations?"**

> "We have a Change Advisory Board (CAB) that meets weekly. Any modification to production systems—no matter how small—goes through CAB review. That includes code deployments, configuration changes, database migrations, everything.
>
> The CAB includes me, our security officer, a representative from the VA's Enterprise Cloud Solutions Office, and our operations manager. We review each proposed change for risk, rollback plan, and timing. High-risk changes only deploy during maintenance windows—Tuesday nights, typically.
>
> For larger initiatives, we go through the VA's governance process. That involves business case development, technical architecture review, privacy impact assessment, and usually multiple rounds of stakeholder approval. A significant feature can take 4-6 months just to get approval to start building."

**Follow-up: "What factors influence the prioritization of these decisions?"**

> "Security findings are always top priority. If our vulnerability scans find a critical issue, everything else stops. We've had to delay feature releases because a security patch took precedence.
>
> After that, it's regulatory deadlines. If OIG (Office of Inspector General) or Congress has mandated something, that's non-negotiable. Then comes leadership directives—what the OCTO (Office of the CTO) or the Secretary's office is asking for.
>
> User-driven improvements come next, usually ranked by volume of help desk tickets or direct veteran feedback. And at the bottom is technical debt—things that would make our lives easier but don't have visible user impact. The VistA timeout issue falls into that category, unfortunately."

**Follow-up: "How do you balance short-term fixes with long-term system improvements?"**

> "Poorly, if I'm being honest. The incentive structure pushes us toward short-term fixes. Leadership wants visible progress, metrics that move, things they can report upward. A quick fix that reduces help desk calls by 10% looks better in a quarterly review than 'we refactored the authentication module to be more maintainable.'
>
> I try to carve out 20% of each sprint for technical debt and platform improvements. In reality, we hit maybe 10% because the urgent always crowds out the important. My team is burning out. They know the system is fragile, they know we're accumulating problems, but they don't have the time to fix them properly.
>
> The best success I've had is bundling long-term improvements into mandated changes. When we had to update our encryption standards for compliance, I snuck in some architectural improvements that weren't strictly required but made the system more resilient. You learn to be opportunistic."

---

## Section 3: Connecting to User Research

**"In our user research, we heard that veterans are confused by having multiple entry points to telehealth—sometimes they click a link from an email, sometimes they go through VA.gov, sometimes through My HealtheVet. From your perspective, what's happening on your end that contributes to this?"**

> "That's the result of organic growth without coordinated governance. VA.gov is our 'front door' initiative—the official entry point. But My HealtheVet existed before VA.gov and has its own loyal user base, mostly older veterans who've used it for years. Neither team wants to abandon their users, so both paths remain.
>
> On the backend, these actually converge to the same APIs, but the UX is different. Different templates, different navigation, different session timeouts. When we send appointment reminder emails, the links go directly to our telehealth portal, bypassing both VA.gov and My HealtheVet entirely. So veterans have three different experiences depending on how they arrive.
>
> There's a unification initiative supposedly in progress, but it's been 'in progress' for two years. The challenge is organizational as much as technical—different product owners, different funding streams, different stakeholders who all have opinions."

---

**"We also observed that many veterans don't understand they need to test their device and connection before their appointment. Is this expected? What constraints led to this design?"**

> "The device check feature exists, but it's buried. When we originally designed onboarding, we had a mandatory tech check—you couldn't complete scheduling without it. We thought it was brilliant: reduce no-shows, reduce support calls, better experience for everyone.
>
> It increased appointment abandonment by 28%. Veterans would hit the tech check, encounter an issue they didn't know how to fix, and give up. Or they'd be scheduling on behalf of someone else and couldn't do the tech check on the right device. The policy team pushed back, accessibility advocates pushed back, and eventually we made it optional.
>
> Now it's a link that says 'Test Your Connection' that most people skip. We send reminders 24 hours before the appointment prompting them to test, but by then it's too late if there's a problem. We know this is suboptimal. We've proposed a 'smart' check that only triggers when we detect potential issues—like first-time users or users on mobile networks—but that's another backlog item."

---

## Closing

**"What haven't I asked about that you think I should know?"**

> "Provider experience. Everyone focuses on veterans, which they should, but our providers are struggling too. The clinician-facing tools are even worse than the patient-facing ones. Some providers have literally gone back to phone calls because the video platform is so frustrating to use.
>
> And the providers who struggle with the technology? They develop workarounds that create their own problems. They give out personal cell phone numbers. They schedule outside the system and manually enter appointments later. Those behaviors create gaps in the record, compliance issues, and fragmented care.
>
> If you want telehealth to succeed, you have to fix both sides of the equation. A perfect patient experience doesn't matter if the provider no-shows because they couldn't figure out how to start the video."

---

**"Who else should I talk to about the VA Telehealth Onboarding and Appointment system?"**

> "Definitely talk to Dr. Patricia Okonkwo in our clinical informatics team. She's been the bridge between clinical staff and technology for about six years. She understands the provider workflow issues I mentioned better than anyone.
>
> Also, reach out to James Turner in our Identity, Credential, and Access Management (ICAM) office. He can explain the authentication constraints in more depth—there's nuance there about why we can't simplify things the way we'd like to.
>
> And if you can get time with Meredith Vance from the Contact Center, she has data on the actual support calls veterans make. She can tell you what's breaking in ways that never reach my team."

---

**"Can I follow up if I have more questions?"**

> "Absolutely. Here's my direct email: marcus.chen@va.gov. I'm also on the VA Slack workspace if you need something quick.
>
> One request: if your research leads to recommendations that could help justify fixing some of these long-standing issues—especially the VistA integration problems—please share that with leadership. Sometimes external voices carry more weight than internal engineering teams saying 'we told you so' for the fifteenth time."

---

## Post-Interview Notes

### Key Constraints Identified

1. **VistA Integration**: 40-year-old legacy system creating latency, timeouts, and duplicate appointment issues
2. **FedRAMP/ATO Process**: 6-9 months to authorize new tools, limiting modern solution adoption
3. **MFA Requirements**: 34% drop-off at authentication step due to policy-mandated friction
4. **Talent Shortage**: 40-60% private sector pay differential causing turnover
5. **Federal Budget Cycles**: Annual funding creates feast/famine development rhythm

### Surprising Insights

- Mandatory tech check was removed because it *increased* abandonment by 28%
- Provider experience may be worse than patient experience
- Unified monitoring across systems doesn't exist—engineering checks 4 different dashboards
- "Orphaned appointments" queue is manually reviewed daily (band-aid process)

### Connections to User Research

| User Finding | Engineering Context |
|--------------|---------------------|
| Multiple entry points confusion | Three different UX paths (VA.gov, My HealtheVet, email links) with no coordinated governance |
| Device check awareness gap | Originally mandatory, made optional after 28% abandonment increase |
| Timeout frustration | Known VistA latency issue, 3-year-old backlog item deprioritized |
| Duplicate appointments | 847 incidents last month due to VistA timeout/confirmation failures |

### Follow-up Questions

1. What would a unified monitoring solution require (budget, timeline)?
2. How does the 15-minute availability sync impact scheduling conflicts in practice?
3. Can we get access to error/timeout metrics for the user journey?
4. What did the "proxy scheduling" policy negotiation entail?

### Recommended Additional Interviews

| Name | Role | Focus Area |
|------|------|------------|
| Dr. Patricia Okonkwo | Clinical Informatics | Provider workflow, clinical perspective |
| James Turner | ICAM Office | Authentication constraints, identity verification |
| Meredith Vance | Contact Center | Support call data, real user issues |

---

*Interview documented by Jordan (UX Researcher)*  
*Qori-generated guide used • January 21, 2026*
