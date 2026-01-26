# 📋 Stakeholder Interview Response

> **Study:** VA Health and Benefits Mobile App  
> **Stakeholder:** Jasmine Oyelaran, Design Lead  
> **Date:** January 26, 2026  
> **Duration:** 49 minutes  
> **Interviewer:** Research Team

---

## Participant Profile

| | |
|---|---|
| **Name** | Jasmine Oyelaran |
| **Role** | Design Lead, VA Mobile Experience Team |
| **Tenure** | 3 years at VA, 11 years in mobile UX design |
| **Team Size** | 6 designers (3 UX, 2 UI, 1 content designer) |
| **Primary Focus** | Mobile app information architecture, accessibility, design system, veteran experience flows |

---

## Opening Context

**"Can you tell me about your role and how you work with the mobile app team?"**

> "I lead the design team for the VA mobile app. We're responsible for the end-to-end veteran experience—from the moment they download the app through every feature they use.
>
> My role is translating veteran needs into designs that work within our constraints. That 'within constraints' part is critical. I spend more time figuring out what we *can't* do than what we should do. Engineering constraints, policy constraints, backend limitations—by the time I factor all that in, the design space is pretty narrow.
>
> Day to day, I'm reviewing design work, conducting design critiques, advocating for user needs in product meetings, and documenting design decisions so we don't repeat debates we've already had. I also maintain our mobile design system, which is a constant effort to keep consistent as we add features.
>
> The mobile app is supposed to be simpler than the web experience—that's the whole point of mobile. But 'simple' is really hard when you're dealing with complex VA systems and policies. I'm always fighting against complexity creeping in."

---

## Section 1: Technical Constraints Impact on Design

### Question 1: Technical Constraints Affecting Design

**"What technical constraints most affect your design decisions?"**

> "The biggest one is **data availability and latency**. I can design the most beautiful, intuitive interface in the world, but if the data takes 10 seconds to load, the design fails. Loading states, error states, empty states—these aren't edge cases for us, they're primary states. Veterans spend a significant amount of time looking at spinners and error messages.
>
> I've redesigned our loading experience three times trying to make waiting feel less frustrating. Progress indicators, skeleton screens, optimistic UI—we've tried it all. But you can't design away a 12-second backend response. The loading experience is still frustrating because waiting is frustrating.
>
> **Screen size constraints** interact with data complexity in painful ways. A veteran's claim might have 15 different status fields that matter. On a desktop, you can show all of them. On mobile, you have to decide what's most important—and that decision is different for every veteran depending on where they are in the process. We end up with 'tap to see more' patterns that add friction but are necessary to avoid overwhelming small screens.
>
> **Offline capability** limitations shape a lot of my design thinking. I'd love to let veterans start forms offline and sync when connected. But our backend architecture doesn't support that well, so I have to design experiences that fail gracefully when connectivity drops. 'Graceful failure' is not a great design goal, but it's reality."

**Follow-up: "How do these constraints show up in the veteran experience?"**

> "Veterans experience it as 'why is this so hard?' moments. They expect mobile apps to be fast and simple—that's what consumer apps have trained them on. When our app is slow or requires multiple steps for something that feels simple, they blame the app. They don't know about the backend latency or the policy requirements. They just know it doesn't feel good.
>
> The onboarding flow is where this is most painful. Veterans download the app expecting to check their claim status in 30 seconds. Instead, they face: download → account creation → identity proofing (multiple steps) → MFA setup → waiting for verification → finally, access. By the time they see their data, they're exhausted. Some don't make it at all.
>
> We've done extensive research on onboarding. The number one reason veterans abandon is 'this is taking too long.' Not 'this is too hard'—too *long*. The technical requirements create length we can't design around."

---

### Question 2: Design System Constraints

**"How does the VA design system affect your mobile work?"**

> "We use the VA.gov Design System (VADS) as our foundation, but it was built for web first. Mobile patterns were added later and sometimes feel like afterthoughts.
>
> Certain components don't translate well to mobile. The web forms use a lot of progressive disclosure that works with scroll—you reveal more as you move down the page. On mobile, progressive disclosure often means more taps, which can feel tedious. But we can't just invent new patterns; we need to use VADS for consistency.
>
> The approval process for new mobile-specific components is lengthy. If I identify a pattern that would work better on mobile—say, a swipe-to-dismiss notification card—I need to propose it to the design system team, go through review, get it documented, have engineering implement it. By the time it's official, we've often shipped something inferior just to meet deadlines.
>
> The positive side is that VADS ensures accessibility is baked in. Every VADS component has been tested with assistive technology. When I use VADS components, I start with an accessible baseline. When I have to create custom components, I lose that safety net."

---

### Question 3: Cross-Platform Design Challenges

**"How do you handle designing for both iOS and Android?"**

> "Platform divergence is a constant tension. iOS and Android have different interaction paradigms, different navigation patterns, different user expectations. Veterans who use iPhones expect the app to feel like an iPhone app. Android users expect Android conventions.
>
> In theory, we design a single experience that works on both. In practice, we make compromises that feel native to neither platform. Our navigation drawer, for example, is a middle ground between iOS's tab bar preference and Android's hamburger menu pattern. It's not quite right for either platform, but maintaining two separate design systems would be unsustainable with our team size.
>
> The biggest divergence is in notification handling. iOS and Android handle push notifications very differently—what you can show, how users interact with them, where they surface. I've designed notification experiences that work beautifully on iOS and are impossible to implement on Android, or vice versa. We end up designing for the more restricted platform, which means iOS users get a worse experience than their platform could support.
>
> Accessibility implementations also differ between platforms. iOS VoiceOver and Android TalkBack behave differently. A screen that's perfectly accessible on iOS might have issues on Android. We test on both, but bugs slip through."

---

## Section 2: Policy and Compliance Impact on Design

### Question 1: Policy Shaping Design

**"How do policy requirements shape your design decisions?"**

> "Session timeout policy is the one I fight most. VA policy requires session timeout after 30 minutes of inactivity for PHI access. I understand the security rationale, but mobile usage patterns are bursty—veterans open the app, check something, put it down, come back later.
>
> I've designed session extension prompts, 'stay logged in' buttons, gentle warnings before timeout. But the fundamental constraint is fixed. Veterans will get logged out, and logging back in requires biometrics at minimum, full re-authentication if biometrics fail.
>
> Every form I design, I think about timeout. Can a veteran complete this form in one session? If not, where should we auto-save? What happens if they time out mid-submission? These aren't design questions I'd face in a consumer app, but they're central to VA design.
>
> **Privacy requirements** also shape notification design. I'd love to show message previews on the lock screen—'Dr. Smith responded to your message.' But that could expose who the veteran's doctor is, which is considered PHI. So our notifications say 'You have a new secure message.' It's less useful but more private.
>
> We've debated letting veterans opt into richer notifications—accepting privacy trade-offs for convenience. Policy hasn't approved that. All veterans get the same privacy-protective experience, even if some would prefer more convenience."

**Follow-up: "What policy constraints feel most frustrating from a design perspective?"**

> "The authentication requirements create a first-impression problem. The app's onboarding experience—the first thing veterans encounter—is dictated by policy, not design. I can't redesign identity proofing to be delightful. I can only make it marginally less painful.
>
> It's like being an interior designer but you can't change the front door. The entry experience defines perception, and I don't control it.
>
> The **consent and disclosure requirements** are similarly frustrating. Legal requires specific language that's verbose and full of jargon. I can suggest plain language alternatives, but legal usually insists on precise terminology for liability reasons. So veterans see screens of text they don't read, clicking 'I agree' without understanding what they're agreeing to.
>
> I've proposed summary versions—'In plain terms: we'll protect your data and only share it for your care'—with full legal text available via 'read more.' Legal said no. The full text has to be visible, not buried. So we have consent screens that feel like punishment."

---

### Question 2: Accessibility as Policy

**"How does accessibility compliance shape your design process?"**

> "Section 508 compliance is non-negotiable, which is actually great. It forces us to design inclusively from the start, not bolt accessibility on at the end.
>
> But there's a difference between compliant and usable. A screen can technically meet WCAG 2.1 AA standards while still being hard to use for someone with low vision or motor impairment. The standards are a floor, not a ceiling.
>
> We test with actual veterans who use assistive technology—screen readers, switch controls, voice control. That's where we find the real issues. A button might have an accessible label, but if the label says 'Submit' and there are three 'Submit' buttons on a flow, screen reader users don't know which one they're on.
>
> The challenge is **retrofitting accessibility** onto features that were built before rigorous a11y standards were enforced. Some older parts of the app have significant accessibility gaps. Fixing them requires engineering time that competes with new features. So we prioritize—critical flows get fixed first—but some accessibility issues persist longer than I'm comfortable with.
>
> **Cognitive accessibility** is an area where we're behind. Many veterans have cognitive differences from TBI, PTSD, age-related changes. The app should support them with plain language, clear structure, minimal memory demands. We're working on this, but it's harder to measure than WCAG compliance, so it gets less attention."

---

## Section 3: Resource and Strategic Constraints

### Question 1: Design Team Capacity

**"What resource constraints affect your team's ability to deliver good design?"**

> "We're six designers supporting an app used by over 2 million veterans. For context, a typical tech company would have that many designers for a single feature area.
>
> The result is that we can't do the design process the way it should be done. We should be doing: discovery research → concept exploration → user testing → iteration → refinement → documentation. What we actually do: rapid exploration → stakeholder review → ship it.
>
> **Research capacity** is particularly limited. We have research partners, but they're shared across VA.gov, the mobile app, and other properties. Getting on their calendar for usability testing takes 4-6 weeks. By then, we've often already shipped.
>
> So we make assumptions. Educated assumptions based on past research, analytics, heuristics—but still assumptions. Sometimes we're wrong, and we don't find out until veterans complain or abandon features.
>
> **Design documentation** suffers most. We should be maintaining comprehensive documentation of design decisions, patterns, and rationale. Instead, it's in our heads or scattered across Figma files. When someone leaves the team, institutional knowledge goes with them."

**Follow-up: "How do you prioritize what gets deep design attention?"**

> "High-visibility, high-risk features get the most attention. If it's going in a press release, if it affects a critical flow like claims or appointments, if leadership is watching—those get proper design process.
>
> Lower-visibility improvements get less attention, even if they'd help a lot of veterans. Improving empty states, refining error messages, smoothing edge case flows—these are important but rarely urgent. They get done in gaps between major projects, if at all.
>
> I've tried to carve out 'design quality' time—20% for polish and refinement. It gets raided constantly for urgent feature work. The urgent always beats the important."

---

### Question 2: Design-Engineering Collaboration

**"How do you work with engineering, and what challenges come up?"**

> "Our engineering collaboration is good at the individual level—I respect Tomás and his team, and we work well together. The challenge is structural.
>
> Engineering capacity determines what designs can ship. I might design an ideal experience that engineering estimates at six sprints. Product says we have two. So we negotiate—what can we cut? What can we simplify?
>
> I call this **design negotiation**. It's a constant dance between what would be best for veterans and what's feasible given time and technical constraints. I've gotten good at designing with constraints in mind, but sometimes I still have to watch features ship in diminished form.
>
> **Technical feasibility feedback** sometimes comes late. I'll spend a week on a design, present it, and engineering says 'the API doesn't support that' or 'that would require backend changes we can't get prioritized.' I try to involve engineering earlier, but everyone's stretched thin. Sometimes the technical reality check comes later than I'd like.
>
> The positive side is that our engineers genuinely care about user experience. When they push back, it's usually 'we can't do this now, but here's a simpler version that achieves most of the same value.' That collaborative problem-solving is what makes things work."

---

### Question 3: Stakeholder Competing Priorities

**"How do competing priorities from different VA stakeholders affect design?"**

> "VHA and VBA have different priorities, and the mobile app serves both. They don't coordinate perfectly, and the design team is caught in the middle.
>
> **Information architecture** is a constant battle. VHA wants health features prominently positioned. VBA wants benefits features prominently positioned. There's limited screen real estate, especially on the home screen. We've tried to balance based on usage data—what do veterans access most?—but that still creates tension.
>
> The 'Health AND Benefits' app framing is philosophically right but operationally challenging. Veterans with only health needs see a bunch of benefits stuff cluttering their experience. Veterans with only benefits needs see health stuff taking up space. We can't fully personalize because the infrastructure doesn't support it well.
>
> **Feature parity** requests are difficult. If My HealtheVet has a feature, VHA asks why the mobile app doesn't. If eBenefits has a feature, VBA asks the same. But the mobile app isn't supposed to replicate web functionality—it's supposed to provide the most essential features in a mobile-optimized way. Explaining 'that's not a mobile use case' is a recurring conversation."

---

## Section 4: Connecting to User Research

**"Users report frustration with the onboarding process. From your design perspective, what's driving that?"**

> "Onboarding is the accumulation of every constraint at once. Identity verification is policy-mandated. The verification steps are determined by ID.me/Login.gov, not us. Session setup has security requirements. By the time veterans get through, they're fatigued.
>
> What I control is minimal—welcome screens, instructional text, progress indication. I've tried to make those as encouraging and clear as possible. But I'm decorating a process I can't redesign.
>
> We did research on onboarding abandonment. Veterans said things like:
>
> - 'I just wanted to see my claim status, not prove who I am.'
> - 'The driver's license photo thing failed three times before it worked.'
> - 'I gave up and called the help line instead.'
>
> The root cause is the identity proofing flow, which is technically sound but terrible UX. It's not designed for mobile—it was designed for web and adapted for mobile poorly. The camera capture, the document positioning, the 'we'll text you a code' steps—all friction points.
>
> I've submitted detailed feedback to the ID.me/Login.gov teams about mobile-specific issues. Some improvements have been made. But they have their own priorities and constraints, and the mobile VA app is one of many consumers of their service."

---

**"Users want to see more information about their claims. What constraints affect what you can show?"**

> "Data availability is the primary constraint. I've designed claim detail screens with all the information veterans want: current status, next step, estimated timeline, examiner notes, requested evidence. Most of those fields don't exist in the API.
>
> What the API gives us is: claim type, filing date, status (one of about 8 values), and sometimes a vague 'steps completed' indicator. That's not enough for veterans who want to understand *why* their claim is taking six months.
>
> I've designed 'aspirational' screens showing what we'd display if the data existed. Product uses those to advocate for API improvements. But API improvements are on the VBA roadmap, not ours. We're dependent on them prioritizing it.
>
> The **claim status terminology** is also a problem. VBA uses internal jargon like 'Pending Decision Approval' or 'Preparation for Notification.' We've added plain-language translations—'A decision has been made and is being reviewed'—but we can only translate terms the API provides. And sometimes the internal terms change without notice, breaking our translations.
>
> Veterans shouldn't need a glossary to understand their claim status. But creating that clarity requires either API changes or access to a definitive terminology source, neither of which we have."

---

**"Users report the app feels 'slow.' What design approaches have you taken to address perceived performance?"**

> "Perceived performance is a design challenge separate from actual performance. I can't make the backend faster, but I can make waiting feel less frustrating.
>
> **Skeleton screens** show the structure of content before data loads. Veterans see something immediate—it tells them 'data is coming, the app didn't freeze.' Our claims list, for example, shows placeholder cards that fill in as data arrives.
>
> **Progressive loading** prioritizes the most important content. On the health summary, we load the next appointment first (what veterans most commonly want), then prescriptions, then messages. Even if the full page takes 8 seconds, veterans see useful information in 2.
>
> **Optimistic UI** shows success immediately for actions, confirming in the background. When a veteran requests a prescription refill, we show 'Refill requested' instantly, rather than waiting for the API round-trip. If it fails, we surface an error. Failures are rare enough that this improves perceived experience.
>
> **Animations and transitions** fill gaps. A well-designed loading animation takes attention away from the wait. It's a psychological trick, but it works.
>
> What I haven't been able to solve is the really long waits—10+ seconds for claims data. No amount of skeleton screens makes that feel good. For those, my best design is transparent communication: 'Loading your claims data. This may take a moment.'"

---

## Closing

**"What constraint or challenge haven't I asked about that significantly impacts your design work?"**

> "**Legacy decision debt.** The app launched in 2021 with design decisions made quickly under pandemic pressure. Some of those decisions are now constraints. The navigation structure, the information architecture, the visual hierarchy—they're not ideal, but changing them would confuse existing users and require significant engineering effort.
>
> We do incremental improvements, but fundamental restructuring is hard to justify when 'it works.' So I'm designing new features into an architecture I wouldn't have chosen.
>
> The other challenge is **measuring design impact.** We have analytics—downloads, active users, feature usage. But we don't have great measures of satisfaction or ease of use. App store ratings are a signal, but they're biased toward extremes. I believe we're improving the experience, but I can't always prove it."

---

**"Who else should I talk to to better understand design constraints?"**

> "**Ryan Chen** is our content designer. He'll tell you about the language constraints—legal terminology requirements, plain language tensions, character limits. Content is invisible design that matters enormously.
>
> **Alicia Torres** leads the VA.gov Design System team. She can explain why certain mobile patterns aren't in VADS and what it takes to add them.
>
> **Dr. Keisha Williams** in the Center for Innovation focuses on cognitive accessibility. She's done research on veteran cognitive needs that we haven't fully implemented.
>
> And **veterans in the app beta program**. We have about 500 veterans who test early releases. They're enthusiasts, so they're not fully representative, but they give detailed feedback. Some have been with us since launch and can articulate how the app has changed."

---

**"Can I follow up if I have questions?"**

> "Definitely. jasmine.oyelaran@va.gov. I'm also on Slack at @joyelaran.
>
> If your research finds usability issues, especially things that cause confusion or abandonment, please share specifics. 'Veterans find X confusing' is actionable. I can take that to product and engineering as justification for prioritizing fixes. Research findings are currency for design advocacy."

---

## Post-Interview Notes

### Key Constraints Identified

1. **Loading State Dominance**: Backend latency makes spinners/loading a primary experience state, not edge case
2. **First Impression Not Controllable**: Onboarding/identity proofing is policy-mandated, not designable
3. **Session Timeout (30 min)**: Disrupts mobile usage patterns; every form designed around timeout risk
4. **Design System Gaps**: VADS built for web first; mobile components are afterthought, slow to add
5. **6 Designers for 2M+ Users**: No time for proper discovery → testing → iteration process
6. **Cross-Platform Compromise**: iOS and Android differences lead to middle-ground design that's native to neither

### Surprising Insights

- Notification previews can't show doctor names—that's PHI; all notifications are vague by policy
- "Aspirational designs" created to advocate for API improvements that don't exist yet
- Claims status terminology changes without notice, breaking plain-language translations
- Legacy architecture from 2021 pandemic launch now constrains current design
- Design team can't prove satisfaction improvements—no good measurement system

### Connections to User Research

| User Finding | Design Context |
|--------------|----------------|
| Onboarding frustration | Designer controls only welcome screens/progress; ID proofing not designable |
| Want more claim detail | Designed screens exist; API doesn't provide data; dependent on VBA roadmap |
| App feels slow | Skeleton screens, progressive loading, optimistic UI all deployed; can't fix 10+ sec backend waits |
| Feature inconsistency | VHA vs VBA competing priorities; can't personalize well with current infrastructure |

### Follow-up Questions

1. Can we see the "aspirational" claim detail designs?
2. What's the timeline for VADS mobile component improvements?
3. How often does the beta program feedback lead to actual changes?
4. What would proper cognitive accessibility investment look like?

### Recommended Additional Interviews

| Name | Role | Focus Area |
|------|------|------------|
| Ryan Chen | Content Designer | Language constraints, legal terminology, plain language tensions |
| Alicia Torres | VA.gov Design System Lead | Mobile pattern gaps, component approval process |
| Dr. Keisha Williams | Center for Innovation | Cognitive accessibility research and gaps |
| Beta program veterans | Early testers | Longitudinal perspective on app changes |

---

*Interview documented by Research Team*  
*Qori-generated guide used • January 26, 2026*
