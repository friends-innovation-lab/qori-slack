# 📋 Stakeholder Interview Response

> **Study:** VA Health and Benefits Mobile App  
> **Stakeholder:** Tomás Reyes, Engineering Lead  
> **Date:** January 26, 2026  
> **Duration:** 54 minutes  
> **Interviewer:** Research Team

---

## Participant Profile

| | |
|---|---|
| **Name** | Tomás Reyes |
| **Role** | Engineering Lead, VA Mobile Platform Team |
| **Tenure** | 5 years at VA, 14 years in mobile development |
| **Team Size** | 12 engineers (5 iOS, 4 Android, 2 backend, 1 QA lead) |
| **Primary Systems** | VA Mobile App, Mobile API Gateway, Push Notification Service, Biometric Auth Module |

---

## Opening Context

**"Can you tell me about your role and how you work with the mobile app team?"**

> "I lead the engineering team responsible for the VA Health and Benefits mobile app. We handle both the native iOS and Android codebases, plus the mobile-specific API gateway that sits between the app and VA's backend systems.
>
> My role is part technical leadership, part traffic cop. I'm making sure our code is solid, our releases don't break things, and that we're not promising features we can't actually deliver given our backend dependencies. The mobile app is the tip of the iceberg—what veterans see is maybe 10% of the complexity. The other 90% is wrestling with systems that were never designed for mobile consumption.
>
> On any given day, I'm reviewing PRs, debugging API integration issues, negotiating with backend teams for endpoint changes, and explaining to product why something that sounds simple is actually a three-sprint effort."

---

## Section 1: Technical Constraints

### Question 1: Biggest Technical Constraints

**"What are the biggest technical constraints your team faces when building mobile features?"**

> "The fundamental constraint is that we're building a modern mobile experience on top of backend systems designed for desktop web applications—or worse, green-screen terminals from the 1980s.
>
> Our biggest pain point is the **Mobile API Gateway**. It's supposed to be the translation layer between our app and VA's backend services, but it's become a bottleneck. Every new feature requires gateway changes, and the gateway team is shared across multiple VA products. Their backlog is six months deep. So even if my team can build the mobile UI in two weeks, we might wait four months for the gateway endpoint we need.
>
> The second constraint is **offline capability**—or lack thereof. Veterans use our app in VA facilities with terrible cell reception, in rural areas with no signal, during travel. They expect things to work. But most of our backend calls require real-time connectivity. We've built some caching, but it's brittle. If cached data gets stale and the veteran takes an action based on outdated info, we've got a problem.
>
> Third is **device fragmentation**. We support iOS back to version 14 and Android back to version 10. That's millions of veterans on older devices. Every feature has to work on a six-year-old phone with limited memory. We've had to kill features that worked beautifully on new devices but crashed older ones."

**Follow-up: "How do these constraints show up in the user experience?"**

> "Loading spinners. So many loading spinners. Veterans tap something, and they wait. Sometimes 3 seconds, sometimes 15, sometimes it times out entirely. That's not our code being slow—that's the backend systems we're calling.
>
> The claims status feature is the worst offender. Veterans check their claim status obsessively—I would too. But the Benefits API sometimes takes 8-12 seconds to respond. We show a loading state, but veterans don't know if it's working or frozen. We've had support tickets where veterans force-quit the app thinking it crashed, when actually the response was about to come through.
>
> The offline issue shows up as cryptic error messages. 'Unable to load data. Please check your connection.' Veterans get this in the middle of a VA hospital where they definitely have WiFi. But our app can't tell the difference between 'no network' and 'network exists but the backend is down.' So we show a generic error that frustrates everyone."

**Follow-up: "Which constraints are hardest to work around?"**

> "Backend response times. We can optimize our code all day, but if VBA's claims system takes 10 seconds to respond, veterans wait 10 seconds. We've tried aggressive caching, background refresh, predictive loading—it helps at the margins, but the fundamental problem is upstream.
>
> The only real solution would be dedicated mobile-optimized backend services, but that would require a massive investment VA hasn't prioritized. We're told to make do with what exists."

---

### Question 2: Adding New Features

**"Walk me through what happens when you want to add a new feature—what technical hurdles come up?"**

> "Let me use a real example: adding the ability to view lab results in the app. Sounds straightforward, right? Veterans can see lab results on My HealtheVet, so just show them in the app.
>
> **Step 1: API Discovery.** Does an API exist that returns lab results in a mobile-friendly format? Usually no. The existing web API returns HTML fragments designed to be embedded in a web page. We need JSON. So now we need the Health API team to create a new endpoint or modify the existing one.
>
> **Step 2: Gateway Integration.** Once the backend API exists, the Mobile Gateway team has to expose it to our app. They need to handle authentication, rate limiting, error transformation, logging. That's another ticket in another team's backlog.
>
> **Step 3: Security Review.** Lab results are sensitive health data. Information Security has to review the data flow, approve the caching strategy, verify encryption. This takes 4-6 weeks minimum.
>
> **Step 4: Accessibility Review.** Our accessibility team reviews the UI for screen reader compatibility, contrast ratios, touch target sizes. We build to WCAG 2.1 AA, but reviews still catch issues.
>
> **Step 5: Build and Test.** Finally, my team can build the feature. Two to three sprints typically.
>
> **Step 6: Staged Rollout.** We don't flip features on for everyone. We start with 1% of users, monitor crash rates and error logs, slowly ramp up. Full rollout takes another 3-4 weeks.
>
> Total timeline for 'just show lab results': 6-9 months. The actual engineering work is maybe 15% of that time."

**Follow-up: "Where do you typically get stuck?"**

> "Step 1 and 2—API availability and gateway capacity. We spend more time waiting for backend dependencies than actually building mobile features.
>
> The frustrating part is these dependencies aren't visible to users or even to product leadership. They see 'lab results feature' on the roadmap with an estimated date, and when it slips, engineering looks slow. But we hit our estimates for the mobile work. The slippage is always in the parts we don't control."

---

### Question 3: Backend Systems and APIs

**"How do backend systems and APIs affect what you can deliver on mobile?"**

> "They're the limiting factor for almost everything.
>
> **VistA** is the health record system. It's ancient but mission-critical. The APIs we have into VistA were designed for internal VA use, not consumer mobile apps. They return way more data than we need, in formats that are hard to parse, with field names that only make sense if you've worked at VA for 20 years.
>
> **VBA systems** for benefits are even worse. Claims status, for example—there's no real-time API. We're essentially scraping data from a system designed for claims processors, not veterans. The data model doesn't match how veterans think about their claims.
>
> **VA Profile** is actually decent—it's a newer system for contact information, notification preferences, etc. When we integrate with modern systems, features come together quickly. When we integrate with legacy systems, everything is painful.
>
> **MHV (My HealtheVet)** is complicated. It has features veterans want—secure messaging, pharmacy refills—but it's a separate platform with its own authentication. We've done some integration, but it's duct tape and baling wire. Veterans have to re-authenticate sometimes, which breaks the 'single app' experience we're going for."

**Follow-up: "Which systems are most limiting?"**

> "VBA claims systems, without question. Veterans care deeply about their claims—it's money, it's recognition of their service, it's healthcare access. And our visibility into the claims process is like looking through frosted glass. We can show high-level status, but we can't show the detail veterans want: 'Why is it taking so long? What's the next step? When will someone look at this?'
>
> That information exists in the claims processing systems, but it's not exposed via API. The claims processors can see it on their screens, but we can't pull it into the app. We've been asking for better claims APIs for three years."

---

## Section 2: Policy and Compliance Constraints

### Question 1: Policy Impact on Decisions

**"What policy or compliance requirements most impact your mobile product decisions?"**

> "**Authentication requirements** are the big one. VA policy requires strong authentication for any PHI access. That means Login.gov or ID.me with identity proofing. We can't let veterans use simple username/password like a consumer app.
>
> This creates the cold start problem. A veteran downloads the app, excited to check their benefits. First thing they see is a multi-step identity verification process that requires uploading a driver's license, taking a selfie, and sometimes a video call. Our analytics show 40% of veterans who start this process don't complete it. They delete the app and never come back.
>
> We've pushed for a 'limited mode' where veterans could see some information with lighter authentication—appointment times without health details, general benefits info without personal claims data. Policy said no. It's all-or-nothing identity proofing, or no access.
>
> **Biometric authentication** is the silver lining. Once veterans get through initial setup, they can use Face ID or fingerprint for subsequent logins. That's a much better daily experience. But that first-time setup is brutal."

**Follow-up: "How do these requirements change your feature designs?"**

> "We design around session management obsessively. VA policy requires session timeout after 30 minutes of inactivity for PHI access. That's reasonable for a desktop browser session, but mobile is different. Veterans open the app, get distracted, come back an hour later—and they're logged out. They have to re-authenticate.
>
> We've implemented 'remember me' with biometrics, but there are limits to what we can do within policy. We can't keep PHI sessions alive indefinitely. So we design flows to be completable quickly—if a veteran is doing something important, we want them to finish before the session times out.
>
> We also design for interruption. Mobile users get phone calls, switch apps, put their phone down. Our forms save draft state aggressively so veterans don't lose work if their session expires mid-task."

---

### Question 2: Approval Process

**"Describe the approval process for new mobile features—what gates do you go through?"**

> "It's a gauntlet. Let me walk through the full list:
>
> **Product Review Board**: Monthly meeting where we pitch features. They prioritize based on strategic alignment, user demand, and resource availability. Features can sit in this queue for months.
>
> **Architecture Review**: If the feature involves new backend integration or significant mobile infrastructure, the Enterprise Architecture team reviews. They're looking for technical soundness, but also consistency with VA's broader technology strategy.
>
> **Security Assessment**: Information Security reviews any feature touching sensitive data. They assess authentication, authorization, data handling, logging, encryption. Findings can require significant rework.
>
> **Privacy Impact Assessment**: If we're collecting new data types or sharing data in new ways, the Privacy Office reviews. This can take 6-8 weeks.
>
> **508 Accessibility Review**: Required before any user-facing feature launches. Our internal accessibility team tests with screen readers, keyboard navigation, color contrast tools.
>
> **ATO Boundary Check**: If a feature changes our security boundary—new data types, new external connections—we might need to update our Authority to Operate. That's a 3-6 month process.
>
> **App Store Review**: Finally, Apple and Google review our app updates. Usually 1-3 days, but they sometimes reject for policy violations we didn't anticipate."

**Follow-up: "Where do features typically get delayed or rejected?"**

> "Security assessment is the most common delay. Not because they find critical vulnerabilities—our code is solid—but because they have questions that require back-and-forth. 'Why are you caching this data? What's the retention period? How do you handle device compromise?'
>
> These are fair questions, but each cycle takes time. A security assessment that could theoretically take two weeks ends up taking six because of scheduling, revisions, re-reviews.
>
> Outright rejections are rare, but scope reductions are common. We'll propose a feature, and security or privacy will say 'you can do this part, but not that part.' So we ship a limited version that's less useful than what we designed."

---

### Question 3: Privacy and Security Shaping Features

**"How do privacy and security requirements shape what you can build?"**

> "Everything is designed with the assumption that the device could be compromised. We can't store sensitive data unencrypted. We can't assume the network is secure. We can't trust that the person holding the phone is the veteran who authenticated.
>
> This leads to some UX friction. We could pre-populate forms with saved data, but policy limits what we can cache. We could show appointment details on the lock screen notification, but that might expose PHI to someone looking over the veteran's shoulder. We err on the side of privacy, which sometimes means more taps to get to information.
>
> **Secure messaging** is a good example of policy shaping design. Veterans want to message their doctors through the app—and they can. But we can't show message previews in notifications because that's PHI. So the notification just says 'You have a new message.' Veterans complain it's not helpful. But the alternative—showing 'Your lab results for HIV test are ready'—could out someone's private health information."

**Follow-up: "What user-requested features have you had to say no to because of policy?"**

> "**Family access** is the most requested feature we can't do. Veterans want to share app access with their spouse or caregiver. Makes total sense—if I'm incapacitated, my wife should be able to check my claim status or schedule my appointments.
>
> But the authentication policy is individual. We can't let Veteran A's credentials be used by Family Member B, even with permission. There's a whole caregiver delegation framework being developed, but it's years away from being API-ready.
>
> **Appointment sharing** with calendar apps is another one. Veterans want their VA appointments in Google Calendar or Apple Calendar. We could technically do this, but the appointment data includes clinic names and provider names that policy considers PHI. So we can't export it to third-party calendars that might sync to the cloud, be backed up insecurely, or be visible to family members with shared calendar access.
>
> We've heard the same feedback from dozens of veterans. 'Why can't I just add this to my calendar?' The answer is policy, but we can't really explain that in a way that doesn't sound like bureaucratic nonsense."

---

## Section 3: Resource and Strategic Constraints

### Question 1: Roadmap Prioritization

**"How do you decide what makes it onto your roadmap versus what gets deprioritized?"**

> "We use a weighted scoring model, but I'll be honest—the weights are heavily influenced by political reality.
>
> **Mandatory items** always come first: security patches, accessibility remediation, app store policy compliance. These aren't negotiable.
>
> **Leadership priorities** come next. If the VA Secretary mentions the mobile app in a speech, features related to that speech suddenly become urgent. If Congress asks questions about mobile capabilities, those capabilities get prioritized.
>
> **User demand** is third, measured by support ticket volume, app store reviews, and research findings. This is where most user-requested features land.
>
> **Technical debt** is last. We have a list of things that would make the app faster, more stable, more maintainable. We rarely get to them. We're always sprinting to the next feature, and tech debt accumulates.
>
> The honest truth is that 'serving users' and 'serving leadership visibility' aren't always aligned. A feature that affects 100,000 veterans daily might get deprioritized for a feature that will be in a press release, even if that feature affects 5,000 veterans."

**Follow-up: "Who influences these decisions?"**

> "Product Owner has the official call, but they're influenced by:
>
> - **OCTO leadership** (Office of the CTO): They set strategic direction and can override priorities.
> - **VHA and VBA stakeholders**: They represent the health and benefits sides of VA. When they ask for mobile features supporting their programs, that carries weight.
> - **Congressional affairs**: If there's congressional interest in a topic, mobile features related to it get attention.
> - **Veteran Service Organizations**: VSOs like the American Legion and VFW provide feedback that leadership takes seriously.
>
> My team's input is technical feasibility and effort estimation. We can say 'this will take six months,' which affects prioritization. But we don't decide *what* to build, just *how hard* it is to build."

---

### Question 2: Resource Constraints

**"What resource constraints affect your ability to deliver features users want?"**

> "**Team size** is the fundamental constraint. We have 12 engineers supporting an app with 2.3 million active users. For comparison, a fintech app of similar complexity might have 50-100 engineers.
>
> We're always understaffed for the scope of what we're asked to do. When someone leaves, it takes 4-6 months to backfill because of federal hiring processes. During that gap, the remaining team absorbs the work.
>
> **Backend team capacity** is the constraint I mentioned earlier. My team could ship more if the backend teams could support us. But they're even more understaffed than we are, and they serve multiple clients—mobile is just one of them.
>
> **Testing device coverage** is an underrated constraint. We need to test on dozens of device/OS combinations. We have a device lab, but it's not comprehensive. Sometimes bugs ship because we didn't test on the specific device model where the bug manifests."

**Follow-up: "Is it more about team capacity, budget, or expertise?"**

> "Capacity primarily. Our engineers are skilled. Our budget is adequate for tooling and infrastructure. We just don't have enough people.
>
> Expertise gaps exist in specific areas. Native mobile performance optimization is specialized—we have one person who really understands iOS memory management at a deep level. If she's out, performance issues pile up.
>
> The federal hiring process makes expertise gaps hard to fill. By the time we get authorization to hire, post the job, review applicants, interview, make an offer, and wait for security clearance, the candidate has often taken another job. We've lost candidates to the private sector mid-process multiple times."

---

### Question 3: Competing Priorities

**"How do competing priorities across different VA departments impact your mobile roadmap?"**

> "It's constant negotiation. VHA wants health features—appointments, prescriptions, health records. VBA wants benefits features—claims, letters, decision documents. They're separate administrations with separate budgets and separate leadership.
>
> When we can only do one thing, someone's unhappy. Last year we had to choose between a VHA priority (telehealth improvements) and a VBA priority (claims document upload). We chose telehealth because COVID had made it urgent. VBA was frustrated—their feature slipped six months.
>
> The app is supposed to be unified—'Health AND Benefits'—but the organizational structure is siloed. We're caught in the middle, trying to serve both while being accountable to neither's full satisfaction.
>
> Sometimes they actively compete. VHA might want us to redesign the health home screen the same month VBA wants us to redesign the benefits home screen. We can't do both. We end up doing neither justice."

**Follow-up: "How do you navigate these situations?"**

> "Escalation, unfortunately. When two important stakeholders want conflicting things, it goes up the chain until someone with authority over both makes the call. That's usually OCTO leadership.
>
> I try to find compromises—can we do a minimal version of both? Can we do one now and commit to the other next quarter? Sometimes that works. Sometimes both stakeholders feel like they got half a loaf and no one's happy.
>
> The best outcomes happen when we can tie features together. 'This backend investment serves both VHA and VBA needs' is an easier sell than 'VHA gets priority this quarter.' We actively look for those dual-benefit opportunities."

---

## Section 4: Connecting to User Research

**"Users want features that aren't available in the app. What's the biggest barrier to adding the features users request most?"**

> "The most requested features fall into three buckets:
>
> **'We'd love to, but the backend doesn't support it.'** Full claims detail, appointment history longer than 13 months, complete prescription history. The data exists in VA systems but isn't exposed via APIs we can access.
>
> **'We'd love to, but policy says no.'** Calendar export, family access delegation, lighter authentication options. The barriers are legal and regulatory, not technical.
>
> **'We'd love to, and it's on the roadmap, but there are 20 things ahead of it.'** Improved health records, better document upload, more notification types. These are coming, eventually. But 'eventually' feels like 'never' to veterans who've been asking for years.
>
> The barrier isn't any single thing—it's the accumulation of constraints. Each one is reasonable in isolation. Together, they create a pace of delivery that frustrates everyone, including us."

---

**"Users experience slow load times or crashes. What's happening on the backend that contributes to performance issues?"**

> "Backend response time is the primary culprit. Our app code executes in milliseconds. The data fetches take seconds—sometimes many seconds.
>
> The claims status endpoint is particularly bad. It aggregates data from multiple VBA systems, and the aggregation happens synchronously. If one system is slow, everything's slow. We've asked for an asynchronous approach where we could show partial data while the rest loads, but that would require significant backend refactoring they can't prioritize.
>
> Crashes are usually memory-related on older devices. Our app loads a lot of data—health records, claims documents, appointment lists. On newer devices with plenty of RAM, it's fine. On a five-year-old phone with 2GB of RAM and 15 other apps running, we hit memory limits and crash.
>
> We've done optimization work, but there's a floor to how lean we can make the app when the data we have to display is genuinely large. A veteran with 10 years of VA history has a lot of records."

---

**"Users are confused by certain app limitations. How do you decide what context to give users about why certain things work the way they do?"**

> "This is an ongoing debate. The design team wants to explain limitations—'why can't I do X?'—so users don't feel like it's broken. But too much explanation makes the app feel apologetic and clunky.
>
> We've landed on a tiered approach:
>
> - **No explanation** for things that work but just not the way users expect. If load times are slow, we show a spinner, not an essay about backend latency.
> - **Brief explanation** for feature boundaries. 'To see records before [date], visit My HealtheVet.' That tells veterans there's a path forward.
> - **Detailed explanation** for errors that require action. 'Your session has expired. For your security, please sign in again.' Veterans understand security even if they don't love it.
>
> What we try to avoid is technical jargon or blaming other systems. Veterans don't care that 'the Benefits API returned a 500 error.' They care that their claims status won't load and they don't know why."

---

## Closing

**"What constraint or challenge haven't I asked about that significantly impacts your product decisions?"**

> "**App store unpredictability.** Apple and Google are gatekeepers, and their rules change without warning. Apple once rejected an update because our medication reminders could be construed as 'medical device functionality,' which has extra regulatory requirements. It took three weeks and multiple appeals to get approved.
>
> Another time, Google changed their policy on background location access. We used background location to auto-check veterans in for appointments when they arrived at a VA facility. Suddenly that feature violated policy. We had to rip it out.
>
> We build on platforms we don't control, and the rules can change with our next submission. It's a constant low-level anxiety."

---

**"Who else should I talk to to better understand the technical or policy landscape?"**

> "**Priya Sharma** runs the Mobile API Gateway team. She can tell you exactly how the translation layer between our app and backend systems works—and doesn't work.
>
> **David Washington** is the Information Security lead who reviews our features. He'll give you the unvarnished security perspective on why certain things are hard.
>
> **Carmen Delgado** on the VBA Benefits API team would be valuable. She knows why the claims data is the way it is—the history, the constraints, the roadmap for improvement.
>
> And honestly, talk to **veterans who've stopped using the app**. We do research with active users, but the people who deleted the app and gave up have the most valuable feedback about where we're failing."

---

**"Can I follow up if I have more questions?"**

> "Absolutely. tomas.reyes@va.gov. I'm also on VA Slack—@treyes.
>
> If your research uncovers specific pain points with technical underpinnings, I want to hear about it. Sometimes user research is the ammunition we need to prioritize fixes that have been languishing. 'Users hate this' carries more weight than 'engineers think this is janky.'"

---

## Post-Interview Notes

### Key Constraints Identified

1. **Mobile API Gateway Bottleneck**: Shared team with 6-month backlog; every feature requires gateway changes
2. **Backend Response Times**: Claims status takes 8-12 seconds; veterans don't know if app is working or frozen
3. **Identity Proofing Friction**: 40% of veterans don't complete initial setup; delete app and never return
4. **Device Fragmentation**: Must support 6-year-old phones; features killed for crashing older devices
5. **30-Minute Session Timeout**: Policy-mandated; interrupts mobile usage patterns
6. **12 Engineers for 2.3M Users**: Understaffed relative to app complexity; 4-6 month hiring backfill

### Surprising Insights

- Lab results feature took 6-9 months; actual engineering was 15% of timeline
- "Family access" most requested feature they can't implement due to authentication policy
- Can't export appointments to calendar because clinic/provider names are considered PHI
- App store policy changes can force feature removal with no warning
- Background location check-in feature was killed by Google policy change

### Connections to User Research

| User Finding | Engineering Context |
|--------------|---------------------|
| Slow load times | Backend APIs (especially claims) take 8-12 seconds; mobile code is fast |
| Crashes on older phones | Memory limits; 5-year-old phones with large health records |
| Can't share with family | Authentication policy requires individual identity; delegation framework years away |
| Confusing limitations | Deliberate decision to not over-explain; tiered approach to error context |

### Follow-up Questions

1. What would it take to get dedicated mobile-optimized backend services?
2. Can we see the 40% setup abandonment data in more detail (where exactly do they drop)?
3. What's the timeline on the caregiver delegation framework?
4. How do VHA and VBA roadmap conflicts get resolved in practice?

### Recommended Additional Interviews

| Name | Role | Focus Area |
|------|------|------------|
| Priya Sharma | Mobile API Gateway Team Lead | Translation layer constraints |
| David Washington | Information Security Lead | Security review process, policy rationale |
| Carmen Delgado | VBA Benefits API Team | Claims data constraints and roadmap |
| Veterans who churned | Former users | Why they deleted the app |

---

*Interview documented by Research Team*  
*Qori-generated guide used • January 26, 2026*
