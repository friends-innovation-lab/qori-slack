# 🏛️ Stakeholder Interview Guide

> **Study:** Testing new DB | **Role:** Engineering Lead | **Duration:** 45 minutes

---

## Overview

| | |
|---|---|
| **Stakeholder** | Engineering Lead from Mobile Team Department |
| **Focus Area** | Technical constraints, policy limitations, resource constraints, and backend processes |
| **Goal** | Understand technical and operational constraints that may impact new DB implementation and identify potential blockers or considerations for mobile team integration |

---

## Before the Interview

**Review these materials:**
- [ ] Current mobile app architecture documentation
- [ ] Existing database performance metrics
- [ ] Previous technical debt assessments

**Key user findings to explore:**
- Any mobile app performance issues users have reported
- User workflow patterns that might stress the database
- Mobile-specific data access patterns

---

## Interview Guide

### Opening (3-5 min)

> *Build rapport and set context*

- Thanks for taking the time. I'm researching the new DB implementation and wanted to understand the technical landscape better.
- Everything you share helps us design better solutions. No wrong answers.
- Okay to record? [If applicable]

**Opener:** "To start, can you tell me about your role as Engineering Lead and how the mobile team currently interacts with our database systems?"

---

### Section 1: Technical Constraints (15 min)

> *Understand current technical limitations and architecture considerations*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | Walk me through the current database architecture from the mobile team's perspective. | • What are the biggest pain points? • Where do you see bottlenecks? |
| 2 | What technical constraints are you working within that might impact a database migration? | • How do these constraints affect development velocity? • Which constraints are hardest to work around? |
| 3 | Describe how data flows between the mobile app and current database systems. | • Where do you see the most complexity? • What would an ideal flow look like? |

**Listen for:** Performance bottlenecks, integration challenges, mobile-specific requirements, legacy system dependencies

---

### Section 2: Resource and Process Constraints (15 min)

> *Understand operational limitations and team processes*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | What does your team's current capacity look like for taking on a database migration project? | • What other priorities are competing for resources? • How do you typically handle large infrastructure changes? |
| 2 | Walk me through how database changes typically get implemented and deployed in your team. | • Who needs to be involved in decisions? • What approval processes exist? |
| 3 | What policy or compliance requirements does the mobile team need to consider with database changes? | • How do these requirements impact technical decisions? • What's the approval process for new technologies? |

**Listen for:** Team bandwidth, competing priorities, approval workflows, compliance requirements, risk tolerance

---

### Section 3: Connecting to User Research (7 min)

> *Share relevant user findings and get stakeholder perspective*

"In our user research, we heard about mobile app performance issues. From your perspective..."

| Finding | Question |
|---------|----------|
| Users reporting slow load times on mobile | "What's happening on the backend that might contribute to mobile performance issues?" |
| Users experiencing data sync problems | "How does our current database architecture handle mobile data synchronization, and where do you see potential improvements?" |

---

### Closing (3-5 min)

- "What haven't I asked about the new DB implementation that you think I should know?"
- "Who else should I talk to about database architecture or mobile integration?"
- "Can I follow up if I have more questions as we dive deeper into the technical requirements?"

**Thank them for their time.**

---

## After the Interview

**Capture immediately:**
- [ ] Key technical constraints mentioned
- [ ] Resource limitations and competing priorities
- [ ] Policy/compliance requirements
- [ ] Current architecture pain points
- [ ] Recommendations for other stakeholders
- [ ] Follow-up technical questions

---

## Quick Reference

| If they say... | Probe deeper with... |
|----------------|----------------------|
| "It's complicated" | "Walk me through it step by step" |
| "We can't do that" | "What would need to change to make it possible?" |
| "That's not my area" | "Who would know more about that?" |
| "The current system is fine" | "What challenges do you face with the current setup?" |
| "We don't have bandwidth" | "What would need to shift to make this a priority?" |

---

### References

This guide follows stakeholder research best practices:

- **Steve Portigal** — "Interviewing Users" (stakeholder interview techniques)
- **Erika Hall** — "Just Enough Research" (internal research methods)
- **Kim Goodwin** — "Designing for the Digital Age" (stakeholder alignment)

---

*Generated by Qori*
