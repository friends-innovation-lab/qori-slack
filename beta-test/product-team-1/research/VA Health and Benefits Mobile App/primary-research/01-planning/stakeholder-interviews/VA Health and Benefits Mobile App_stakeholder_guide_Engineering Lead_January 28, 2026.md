# 🏛️ Stakeholder Interview Guide

> **Study:** VA Health and Benefits Mobile App | **Role:** Engineering Lead | **Duration:** 45 minutes

---

## Overview

| | |
|---|---|
| **Stakeholder** | Engineering Lead from Mobile Platform Team |
| **Focus Area** | Technical constraints, system architecture, and development processes |
| **Goal** | Understand technical limitations, resource constraints, and backend processes that impact user experience and inform design decisions |

---

## Before the Interview

**Review these materials:**
- [ ] Current mobile app architecture documentation
- [ ] Recent user feedback about app performance and functionality
- [ ] Any existing technical debt or constraint documentation

**Key user findings to explore:**
- Performance issues and slow load times reported by users
- Feature limitations that users encounter
- Integration problems between health and benefits systems

---

## Interview Guide

### Opening (3-5 min)

> *Build rapport and set context*

- Thanks for taking the time. I'm researching the VA mobile app experience and wanted to understand the technical landscape better.
- Everything you share helps us design better solutions. No wrong answers.
- Okay to record? [If applicable]

**Opener:** "To start, can you tell me about your role as Engineering Lead and how you oversee the mobile platform development?"

---

### Section 1: Technical Architecture & Constraints (15 min)

> *Understand the technical foundation and limitations*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | Walk me through the current mobile app architecture and how it connects to VA systems. | • What are the biggest technical bottlenecks? • Which integrations are most challenging? |
| 2 | What are the most significant technical constraints your team faces when building features? | • How do legacy systems impact development? • What would you change if you could rebuild from scratch? |
| 3 | Describe how data flows from backend systems to the mobile app. | • Where do delays typically occur? • Which systems are most reliable vs. problematic? |

**Listen for:** Legacy system dependencies, API limitations, data synchronization issues, security constraints

---

### Section 2: Development Processes & Resource Constraints (12 min)

> *Understand workflow, priorities, and resource limitations*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | How does your team prioritize which features to build or fix? | • Who makes these decisions? • How do user needs factor in? |
| 2 | What does your development and deployment process look like? | • What slows down releases? • How do you handle urgent fixes? |
| 3 | Tell me about your team's capacity and biggest resource challenges. | • What skills are you missing? • How do competing priorities affect mobile development? |

**Listen for:** Approval processes, compliance requirements, staffing gaps, competing organizational priorities

---

### Section 3: Connecting to User Research (10 min)

> *Share relevant user findings and get stakeholder perspective*

"In our user research, we heard several things. From your perspective..."

| Finding | Question |
|---------|----------|
| Users report long load times and app crashes | "What's happening on the backend that might contribute to these performance issues?" |
| Users get confused when data isn't synced between web and mobile | "How do our systems handle data consistency, and what constraints affect real-time updates?" |
| Users want features that aren't available in mobile | "What determines which features can be built for mobile vs. web only?" |

---

### Section 4: Policy & Compliance Constraints (8 min)

> *Understand regulatory and policy limitations*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | How do VA policies and compliance requirements shape what you can build? | • Which requirements most impact user experience? • How do security policies affect functionality? |
| 2 | What approval processes do new features or changes go through? | • How long do these typically take? • What causes delays or rejections? |

**Listen for:** Security protocols, accessibility requirements, data handling restrictions, approval bottlenecks

---

### Closing (5 min)

- "What technical constraints haven't I asked about that significantly impact the user experience?"
- "Who else should I talk to about backend systems or policy requirements?"
- "Can I follow up if I have more questions as our research progresses?"

**Thank them for their time.**

---

## After the Interview

**Capture immediately:**
- [ ] Key technical constraints mentioned
- [ ] Resource and process bottlenecks
- [ ] Connections between technical issues and user pain points
- [ ] Policy/compliance factors affecting UX
- [ ] Other stakeholders to interview (backend engineers, compliance, etc.)

---

## Quick Reference

| If they say... | Probe deeper with... |
|----------------|----------------------|
| "The legacy systems are complicated" | "Walk me through how a typical user request moves through these systems" |
| "We can't do that for security reasons" | "What would need to change to make it possible while staying compliant?" |
| "That's a backend issue" | "Who owns that system and how do you coordinate with them?" |
| "Users don't understand the limitations" | "What constraints are invisible to users but affect their experience?" |

---

### References

This guide follows stakeholder research best practices:

- **Steve Portigal** — "Interviewing Users" (stakeholder interview techniques)
- **Erika Hall** — "Just Enough Research" (internal research methods)
- **Kim Goodwin** — "Designing for the Digital Age" (stakeholder alignment)

---

*Generated by Qori*
