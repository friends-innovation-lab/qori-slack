# 📋 Stakeholder Interview Response

> **Study:** VA Telehealth Onboarding and Appointment  
> **Stakeholder:** Aisha Robinson, Design Lead  
> **Date:** January 21, 2026  
> **Duration:** 48 minutes  
> **Interviewer:** Jordan (UX Researcher)

---

## Participant Profile

| | |
|---|---|
| **Name** | Aisha Robinson |
| **Role** | Design Lead, VA Digital Experience |
| **Tenure** | 3 years at VA, 9 years in civic tech / healthcare UX |
| **Team Size** | 5 designers (2 UX, 2 UI, 1 content designer) |
| **Primary Focus** | Patient-facing telehealth flows, VA Design System compliance, accessibility |

---

## Opening Context

**"Can you tell me about your role and how you interact with VA Telehealth Onboarding and Appointment?"**

> "I lead the design team responsible for the veteran-facing experience of our telehealth platform. That means everything from the moment someone decides they want a virtual appointment to the moment they're actually in the video call with their provider.
>
> My interaction with the system is primarily through the design artifacts we create—user flows, wireframes, prototypes—and then seeing how those translate (or don't translate) into the actual shipped product. I also spend a lot of time negotiating. Negotiating with engineering about what's feasible, with policy about what's required, with accessibility specialists about what's compliant, and with leadership about what's prioritized.
>
> Honestly, about 40% of my job is design work. The other 60% is alignment, documentation, and fighting for the user in rooms where the user isn't present."

---

## Section 1: Constraints (Technical, Policy, Resource)

### Question 1: Technical Constraints

**"What are the biggest technical constraints affecting the onboarding process?"**

> "The design system is both a blessing and a constraint. We use the VA Design System—VADS—which is based on USWDS, the U.S. Web Design System. It gives us consistency, accessibility baked in, and credibility. But it also means we can't just design whatever we want.
>
> Every component has to exist in VADS or go through an approval process to get added. That takes months. So when I design an interaction that would be perfect for veterans—say, a visual calendar picker that shows available slots at a glance—I have to check: does this component exist? If not, can we build a custom one? Usually the answer is 'use what we have,' which means veterans get a less optimal experience because the ideal component isn't in our toolkit.
>
> The other big constraint is cross-platform consistency. We're designing for VA.gov, the VA mobile app, My HealtheVet, and sometimes kiosk interfaces at VA facilities. They don't share a codebase. So I design one experience, and it gets implemented four different ways by four different teams with varying fidelity. The 'seamless omnichannel experience' we talk about in presentations doesn't exist in reality."

**Follow-up: "Can you provide an example?"**

> "The appointment confirmation flow. I designed a clear, linear experience: you pick a time, you see a summary, you confirm, you get a confirmation screen with calendar integration and clear next steps.
>
> What shipped on VA.gov was pretty close to the design. What shipped in the mobile app was missing the calendar integration because they couldn't get the native calendar APIs working in time. My HealtheVet implemented a completely different confirmation pattern because their team had legacy code they didn't want to refactor. And the kiosk version? I don't even know what that looks like—different contractor, different process entirely.
>
> From a veteran's perspective, if they use multiple touchpoints, the experience feels inconsistent. They learn the flow on their phone, try to do it on their desktop, and it's just different enough to be confusing."

**Follow-up: "How do these constraints impact user experience?"**

> "It creates what I call 'design debt.' We ship something that's 70% of what we envisioned because of constraints, promising ourselves we'll iterate and improve. But then the next project starts, priorities shift, and that 70% becomes the permanent state.
>
> Veterans experience this as friction. Little moments of confusion that individually seem minor but accumulate. Why does this button say 'Continue' here but 'Next' there? Why is the back button in a different place on mobile? Why did my session time out faster on one platform than another? 
>
> We did a heuristic evaluation last year and found 47 inconsistencies between VA.gov and the mobile app in the telehealth flow alone. Forty-seven. Each one is a tiny cognitive tax on veterans."

---

### Question 2: Policy Constraints

**"How do policy constraints influence the design decisions for telehealth appointments?"**

> "Privacy and consent requirements shape almost every screen. Before a veteran can do anything meaningful in telehealth, they have to acknowledge consent forms, privacy notices, terms of use. Legal requires specific language. We can't paraphrase, we can't simplify, we can't hide it in a tooltip. It has to be visible and acknowledged.
>
> I've tried so many times to redesign the consent experience to be less overwhelming. Progressive disclosure, contextual consent, plain language summaries with links to full text. Legal says no every time. They're worried about liability if a veteran claims they didn't understand what they were agreeing to.
>
> So we have these walls of text that veterans have to scroll through and check boxes for. Our analytics show the average time on the consent screen is 4 seconds. Four seconds for three paragraphs of legal language. They're not reading it, they're just checking the box to get through. The design is compliant but not actually serving its purpose."

**Follow-up: "Are there any recent policy changes that have affected the process?"**

> "The EHRM transition—Electronic Health Record Modernization—has been a huge disruptor. Some VA facilities have moved to the new Cerner-based system, others are still on VistA. The policy is that both systems need to be supported, but the data structures are different, the terminology is different, even the appointment types don't map one-to-one.
>
> For design, this means I can't create one unified experience. I have to design branching flows based on which system the veteran's facility uses. It's like designing two products that look the same but behave differently under the hood. Veterans don't know or care which EHR their facility uses—they just want to schedule an appointment. But the backend reality bleeds through into the frontend experience in ways I can't fully mask.
>
> We had to add a whole new screen in the onboarding flow that basically says 'We're checking your facility's system' because the loading time is different depending on VistA vs. Cerner, and we couldn't guarantee a consistent experience. That's a design failure driven by policy and technical reality, not user needs."

---

### Question 3: Resource Constraints

**"In terms of resources, what are the main challenges faced by the team in implementing new features?"**

> "Time, always time. The pressure to ship is relentless. VA leadership wants to show progress, there are Congressional reporting requirements, there are press releases scheduled before the feature is even built. Design gets compressed.
>
> A flow that should get two weeks of design exploration, user testing, and iteration gets five days. We skip the research, we skip the testing, we go straight to 'make it look like this other thing we did before.' Then we're surprised when it doesn't perform well.
>
> The other resource constraint is research operations. I have access to exactly one usability testing platform—it's government-approved but clunky. Recruiting veterans for research requires going through official channels, which takes 4-6 weeks minimum. By the time I could run a proper usability study on a proposed design, the feature has already been built and shipped.
>
> So most of my 'user research' is desk research. Looking at analytics, reading help desk tickets, reviewing accessibility audit findings. It's better than nothing, but it's not the same as watching a veteran actually try to use what we're building."

**Follow-up: "How do resource constraints impact prioritization of tasks?"**

> "We prioritize by visibility and risk. If the Secretary is going to demo it, it gets designed well. If it's going in a press release, it gets designed well. If it's a feature that 100,000 veterans will use but no one important will ever see, it gets the minimum viable design treatment.
>
> Accessibility is the exception—that's non-negotiable regardless of visibility, which I'm grateful for. Section 508 compliance is taken seriously here. But 'accessible' and 'usable' aren't the same thing. A screen can pass WCAG audits and still be confusing as hell.
>
> The stuff that gets deprioritized is the 'polish' work. Error messages, empty states, loading experiences, edge cases. The unsexy but important details that separate a good experience from a frustrating one. We ship the happy path and hope veterans don't stray from it."

---

## Section 2: Processes (Backstage Operations)

### Question 1: Appointment Flow

**"Walk me through how an appointment is scheduled and confirmed in the VA Telehealth system."**

> "From a design perspective, here's the intended flow:
>
> 1. **Entry Point**: Veteran lands on VA.gov or opens the mobile app. They click 'Schedule an Appointment' from the health care hub.
>
> 2. **Authentication**: They sign in with ID.me, DS Logon, or My HealtheVet credentials. Multi-factor authentication required. This is the first drop-off point—we lose a lot of people here.
>
> 3. **Facility Selection**: If they're registered at multiple VA facilities, they pick which one. If it's their first time, they may need to register, which is a whole separate flow I won't get into.
>
> 4. **Appointment Type**: They choose between in-person, phone, or video. For telehealth, they select video.
>
> 5. **Care Type**: They select what kind of care—primary care, mental health, specialty, etc. The options shown depend on what their facility offers via telehealth.
>
> 6. **Provider Selection**: If they have an established relationship, they can request their regular provider. If not, they choose 'first available' or browse providers.
>
> 7. **Date/Time Selection**: They see available slots. This is where the 15-minute sync issue that engineering mentioned bites us—sometimes a slot shows as available but is actually taken.
>
> 8. **Reason for Visit**: Free-text field to describe why they need the appointment. Optional but encouraged.
>
> 9. **Contact Preferences**: How do they want reminders—email, text, both?
>
> 10. **Review & Confirm**: Summary screen showing everything they selected. They confirm.
>
> 11. **Confirmation**: Success message with appointment details, option to add to calendar, link to pre-visit checklist, information about how to join the video call.
>
> Total steps: 11 screens minimum, more if branching occurs. It's too many. I know it's too many. But each step exists because someone—policy, legal, clinical, engineering—said it had to."

**Follow-up: "What are the key touchpoints in this process?"**

> "The moments that matter most are authentication, time selection, and confirmation.
>
> Authentication because it's the first real interaction and it's also the hardest. If we lose them here, nothing else matters.
>
> Time selection because it's where veterans are making the core decision. If available times don't work for their schedule, they abandon. If the interface is confusing, they book the wrong time and then no-show.
>
> Confirmation because it's our last chance to set them up for success. Clear confirmation reduces anxiety, no-show rates, and support calls. Bad confirmation creates downstream problems.
>
> Honestly, we over-index on the middle steps—facility, type, provider selection—because that's where the business logic lives. But veterans care most about 'can I get in?' and 'did it work?'"

**Follow-up: "Where do bottlenecks typically occur?"**

> "Architecturally, the bottleneck is what I call 'the authentication cliff.' We've done funnel analysis. Of 100 veterans who click 'Schedule Appointment,' only 58 complete authentication. That's a 42% drop-off before they even see an available time slot.
>
> The reasons are varied—forgot password, MFA issues, frustration with ID.me verification, session timeouts. But from a design standpoint, there's only so much I can do. The authentication system isn't mine to redesign. I can optimize the screens before and after, but the auth flow itself is controlled by a separate team with separate priorities.
>
> The second bottleneck is time selection. If the first available appointment is three weeks out, veterans either book reluctantly or abandon and call instead. We can't fix availability—that's a provider capacity issue—but we're exploring designs that set expectations earlier. Something like 'Typical wait time for this care type: 2-3 weeks' before they even start, so they're not surprised and frustrated at step 7."

---

### Question 2: Technical Issue Handling

**"How are technical issues during onboarding or appointments handled by the team?"**

> "During onboarding, we've designed error states for the most common failures—authentication timeout, system unavailable, eligibility check failure. Each error has a message, a suggested action (retry, call help desk, try a different browser), and a help desk number.
>
> The problem is these error messages were written by committee. Legal wanted disclaimers, engineering wanted technical accuracy, I wanted plain language. The result is error messages that are technically correct but not actually helpful. 'We encountered an error processing your request. Error code: VAT-4012. Please try again or contact the VA help desk at 1-800-XXX-XXXX.'
>
> What the veteran needs to know is: 'The system is slow right now. Wait 30 seconds and try again.' But we can't say that because engineering says 'sometimes it's not that, and we don't want to mislead them.' So we default to vague, unhelpful language.
>
> During appointments, the telehealth platform has its own error handling that we don't control. That's the vendor's interface. If a veteran's video call fails, they see the vendor's error messages, not ours. We've given feedback, but we don't have contractual leverage to force UI changes."

**Follow-up: "Are there established protocols for troubleshooting?"**

> "We have a 'Prepare for Your Video Visit' checklist that we link from the confirmation screen and reminder emails. It covers browser requirements, camera/microphone permissions, bandwidth recommendations. The hope is that veterans self-troubleshoot before the appointment.
>
> For issues during the appointment, veterans can call the telehealth help desk. The protocol is: help desk agent tries basic troubleshooting (refresh, check permissions, try a different browser), and if that fails, they offer to convert to a phone appointment instead.
>
> What we don't have—and desperately need—is real-time in-app support. A chat widget or a 'click here if you're having trouble' that surfaces during the video connection flow. Right now, if something goes wrong, the veteran has to find a phone number, call, wait on hold, explain their problem. By then, their appointment time has passed.
>
> I've designed a real-time troubleshooting assistant three times. Three times it's been cut from scope. 'Phase 2,' they say. We're still on phase 1."

---

## Section 3: Connecting to User Research

**"In our user research, we heard that users reported difficulty in navigating the onboarding process. What's happening on your end that might contribute to this?"**

> "Honestly? Too many stakeholders with too many requirements.
>
> The onboarding process has inputs from: clinical teams (we need this intake information), legal (we need these consent acknowledgments), security (we need these verification steps), accessibility (we need these alternative paths), business (we need these analytics touchpoints), and engineering (we can only build what's technically feasible).
>
> Each stakeholder has legitimate needs. But no one is empowered to say 'that's too much, we're cutting it.' So requirements accumulate. Every screen gets one more thing added. 'Can we also ask about preferred pharmacy?' 'Can we also show this disclaimer?' 'Can we also capture their emergency contact?'
>
> I try to be the advocate for simplicity, but I lose those battles more often than I win. The compromise is usually 'make it optional,' which means the screen still exists, still has to be navigated, still creates cognitive load—it just has fewer required fields.
>
> If I could start over with a blank slate and absolute authority, onboarding would be five screens: Sign in → Pick a time → Confirm contact preferences → Done. Everything else would be progressive, asked at the point of care or surfaced only when relevant. But I don't have a blank slate, and I definitely don't have absolute authority."

---

**"Users expressed confusion about appointment availability. Is this expected? What constraints led to this design?"**

> "The availability confusion stems from a fundamental mismatch between how we display information and how the backend actually works.
>
> When a veteran looks at the scheduling interface, they see a calendar with available slots. It looks definitive—like a flight booking system. 'These times are available. Pick one.'
>
> But actually, it's more like a request system. Those slots are 'probably available based on data that's up to 15 minutes old, subject to provider approval, and may conflict with appointments booked through other channels.'
>
> The design constraint is that we can't show real-time availability without hammering the backend systems in a way that would degrade performance. So we sync periodically and present stale data as if it's current.
>
> The honest UX would be to say 'Request an appointment for this time' instead of 'Book this appointment.' But clinical leadership pushed back—they felt 'request' language would undermine confidence in the system. So we kept 'book' or 'schedule' language even though the backend behavior is more like a request.
>
> When a veteran 'books' a slot that's actually no longer available, they get a follow-up message saying 'We couldn't confirm your requested time, here are alternatives.' By then, they thought they were done. It feels like a bait-and-switch, and they're right to be frustrated."

---

## Closing

**"What haven't I asked about that you think I should know?"**

> "The emotional design challenge.
>
> A lot of our veterans are dealing with trauma, chronic illness, mental health challenges, or disability. Telehealth isn't neutral for them—it's healthcare, which carries anxiety, vulnerability, and history.
>
> The current design is very transactional. Step 1, step 2, step 3, done. It doesn't acknowledge the emotional journey. We don't say 'We know scheduling appointments can feel overwhelming' or 'You're doing a great thing by taking care of your health.' We just march them through a process.
>
> I've proposed adding what I call 'emotional waypoints'—moments of acknowledgment and encouragement throughout the flow. Nothing long, just human. Research shows this increases completion rates and satisfaction. But it always gets cut for being 'not essential' or 'too soft.'
>
> The other thing is caregiver experience. A significant percentage of our appointments are scheduled by family members or caregivers on behalf of veterans. The entire system assumes the user IS the patient. We have workarounds—proxy access, caregiver accounts—but they're clunky. The caregiver experience is afterthought design, and it shows."

---

**"Who else should I talk to about VA Telehealth Onboarding and Appointment?"**

> "Definitely talk to Kenji Nakamura on the content team. He writes all the microcopy—button labels, error messages, help text. He has strong opinions about how our constraints force him to write confusing content when he knows exactly how to write it clearly.
>
> Also, I'd recommend talking to Dr. Lena Sorensen, who leads our clinical user experience initiative. She's a physician who transitioned into UX and understands both the provider and patient perspective. She can speak to the clinical workflow issues that cascade into patient-facing problems.
>
> And if you can get access to veteran service organization (VSO) feedback, that's gold. The American Legion and VFW both have digital experience committees that provide input on VA tools. They represent veteran voices at scale and often flag issues we miss."

---

**"Can I follow up if I have more questions?"**

> "Please do. I'm at aisha.robinson@va.gov, and I'm on Teams most of the day.
>
> Actually, one request: if you document findings from this research that support simplifying the onboarding flow, I would love ammunition. I've been fighting for a reduced-step onboarding pilot for two years. External research findings carry more weight than internal design advocacy. If users are telling you it's too complicated, that's data I can use."

---

## Post-Interview Notes

### Key Constraints Identified

1. **VA Design System (VADS)**: Component library limitations force suboptimal design patterns; new components take months to approve
2. **Cross-Platform Inconsistency**: 4 different implementations (VA.gov, mobile app, My HealtheVet, kiosks) create fragmented UX
3. **Legal/Consent Requirements**: Mandatory verbose consent language with 4-second average read time; can't simplify
4. **EHRM Transition**: VistA vs. Cerner split requires branching flows and inconsistent experiences
5. **Research Operations**: 4-6 week recruitment timeline makes real user testing impractical within shipping timelines

### Surprising Insights

- 42% drop-off at authentication before veterans even see available appointment times
- 47 documented inconsistencies between VA.gov and mobile app in telehealth flow alone
- "Request" vs. "Book" language was a deliberate business decision despite backend being request-based
- Real-time troubleshooting assistant designed 3 times, cut from scope 3 times
- Caregiver/proxy experience is "afterthought design"

### Connections to User Research

| User Finding | Design Context |
|--------------|----------------|
| Difficulty navigating onboarding | Too many stakeholders adding requirements; no authority to cut scope |
| Confusion about availability | Stale data (15-min sync) displayed as current; "book" language for request-based system |
| Multiple entry points confusion | 4 different implementations with varying fidelity to original design |
| Consent/terms overwhelm | Legal requires specific language; progressive disclosure attempts rejected |

### Follow-up Questions

1. Can we see the 47 documented inconsistencies between VA.gov and mobile app?
2. What would the reduced-step onboarding pilot look like specifically?
3. How does the design team measure success currently (metrics, KPIs)?
4. What happened to the three real-time troubleshooting assistant designs?

### Recommended Additional Interviews

| Name | Role | Focus Area |
|------|------|------------|
| Kenji Nakamura | Content Design | Microcopy constraints, clear language challenges |
| Dr. Lena Sorensen | Clinical UX Lead | Provider/patient perspective, clinical workflow |
| VSO Digital Committees | American Legion, VFW | Veteran feedback at scale, systemic issues |

---

*Interview documented by Jordan (UX Researcher)*  
*Qori-generated guide used • January 21, 2026*
