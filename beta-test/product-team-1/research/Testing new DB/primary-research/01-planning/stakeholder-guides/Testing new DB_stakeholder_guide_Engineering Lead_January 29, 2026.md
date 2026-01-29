# 🏛️ Stakeholder Interview Guide

> **Study:** Testing new DB | **Role:** Engineering Lead | **Duration:** 45 minutes

---

## Overview

| | |
|---|---|
| **Stakeholder** | Engineering Lead from Mobile Team |
| **Focus Area** | Technical constraints and backend processes for new database implementation |
| **Goal** | Understand technical, policy, and resource constraints that could impact the new DB rollout and identify potential user-facing implications |

---

## Before the Interview

**Review these materials:**
- [ ] Current database architecture documentation
- [ ] Mobile app performance metrics and pain points
- [ ] Any existing user feedback about app performance/reliability

**Key user findings to explore:**
- Performance issues users may have experienced with current system
- Any data inconsistencies or sync problems users have reported

---

## Interview Guide

### Opening (3-5 min)

> *Build rapport and set context*

- Thanks for taking the time. I'm researching our new database implementation and wanted to understand the technical landscape better.
- Everything you share helps us design better solutions. No wrong answers.
- Okay to record? [If applicable]

**Opener:** "To start, can you tell me about your role as Engineering Lead and how you interact with our current database systems?"

---

### Section 1: Technical Constraints (15 min)

> *Understand current technical limitations and new DB requirements*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | Walk me through the biggest technical challenges with our current database setup. | • How do these impact mobile app performance? • Which constraints affect users most directly? |
| 2 | What technical constraints are you most concerned about with the new database implementation? | • What could go wrong during migration? • How might these show up in user experience? |
| 3 | Describe how data flows between the database and mobile app currently. | • Where are the bottlenecks? • What happens when things break? |
| 4 | What technical trade-offs are you having to make with the new system? | • How did you prioritize what to optimize for? • What capabilities might we lose temporarily? |

**Listen for:** Performance bottlenecks, integration challenges, migration risks, infrastructure limitations

---

### Section 2: Resource & Policy Constraints (12 min)

> *Identify organizational and resource limitations*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | What resource constraints are shaping how you approach this database transition? | • Timeline pressures? • Team capacity? • Budget limitations? |
| 2 | Are there any policy or compliance requirements that limit your technical options? | • Data governance rules? • Security policies? • Regulatory constraints? |
| 3 | How do you prioritize what gets built first with the new database? | • What drives those decisions? • Who else has input on priorities? |

**Listen for:** Timeline pressures, team bandwidth, compliance requirements, competing priorities

---

### Section 3: Backend Processes & Operations (10 min)

> *Understand how systems work behind the scenes*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | Walk me through what happens behind the scenes when a user performs [key action] in the mobile app. | • Where could this process fail? • How do you monitor for problems? |
| 2 | How will monitoring and debugging change with the new database? | • What visibility will you have? • How will you catch issues early? |
| 3 | Describe your rollout strategy for the new database. | • Phased approach? • Rollback plans? • How will you measure success? |

**Listen for:** System dependencies, failure points, monitoring gaps, rollout risks

---

### Section 3: Connecting to User Research (8 min)

> *Share relevant user findings and get stakeholder perspective*

"In our user research, we've heard about various performance and reliability issues. From your perspective..."

| Finding | Question |
|---------|----------|
| Users report slow load times or timeouts | "What's happening on the backend that might contribute to these performance issues?" |
| Users experience data sync problems between devices | "Is this expected with our current setup? What technical constraints cause sync delays?" |
| Users lose work or see outdated information | "How does data consistency work currently, and how will the new DB improve this?" |

---

### Closing (5 min)

- "What technical risks or constraints haven't I asked about that could impact users?"
- "Who else should I talk to about the database implementation - other engineers, DevOps, security?"
- "Can I follow up if I have more questions as we move forward with testing?"

**Thank them for their time.**

---

## After the Interview

**Capture immediately:**
- [ ] Key technical constraints mentioned
- [ ] Resource/timeline limitations
- [ ] Policy or compliance blockers
- [ ] User-facing implications of technical decisions
- [ ] Rollout risks and mitigation strategies
- [ ] Other stakeholders to interview (DevOps, Security, Product)

---

## Quick Reference

| If they say... | Probe deeper with... |
|----------------|----------------------|
| "It's complicated" | "Walk me through it step by step" |
| "We can't do that" | "What would need to change to make it possible?" |
| "That's not my area" | "Who would know more about that?" |
| "Users don't understand" | "What do you think causes that confusion?" |
| "It should be fine" | "What could go wrong? What's your backup plan?" |
| "Performance will improve" | "How will you measure that? What if it doesn't?" |

---

### References

This guide follows stakeholder research best practices:

- **Steve Portigal** — "Interviewing Users" (stakeholder interview techniques)
- **Erika Hall** — "Just Enough Research" (internal research methods)
- **Kim Goodwin** — "Designing for the Digital Age" (stakeholder alignment)

---

*Generated by Qori*
