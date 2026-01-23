# 🏛️ Stakeholder Interview Guide

> **Study:** Testing new DB | **Role:** Engineering Lead | **Duration:** 45 minutes

---

## Overview

| | |
|---|---|
| **Stakeholder** | Engineering Lead from Mobile Team |
| **Focus Area** | Technical constraints and backend processes for new database implementation |
| **Goal** | Understand technical, policy, and resource constraints that could impact the new DB rollout, plus backstage operations that affect user experience |

---

## Before the Interview

**Review these materials:**
- [ ] Current database architecture documentation
- [ ] New DB technical specifications and requirements
- [ ] Any existing performance metrics or incident reports

**Key user findings to explore:**
- Performance issues users may have experienced with current system
- Any user-reported bugs that might stem from database limitations

---

## Interview Guide

### Opening (3-5 min)

> *Build rapport and set context*

- Thanks for taking the time. I'm researching our new database implementation and wanted to understand the technical landscape better.
- Everything you share helps us make better decisions about the rollout. No wrong answers.
- Okay to record? [If applicable]

**Opener:** "To start, can you tell me about your role on the mobile team and how you currently interact with our database systems?"

---

### Section 1: Technical Constraints (15 min)

> *Understand current limitations and new DB implications*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | What are the biggest technical constraints you're dealing with in our current database setup? | • How do these show up day-to-day? • Which ones affect users most? |
| 2 | Walk me through what happens when the mobile app makes a database request right now. | • Where do you see bottlenecks? • What breaks most often? |
| 3 | What technical challenges do you anticipate with implementing the new database? | • What keeps you up at night about this migration? • What would success look like? |
| 4 | How do current database limitations affect what features you can build? | • Can you give me a specific example? • What workarounds have you had to create? |

**Listen for:** Performance bottlenecks, integration challenges, migration risks, feature limitations

---

### Section 2: Resource & Policy Constraints (12 min)

> *Understand non-technical barriers and organizational factors*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | What resource constraints are you working within for this database project? | • How does this compare to other projects? • What would ideal resourcing look like? |
| 2 | Are there any policy or compliance requirements that affect how you can implement the new database? | • How do these requirements shape your technical decisions? • Who enforces these policies? |
| 3 | How do you prioritize database work against other mobile team responsibilities? | • What drives those priority decisions? • Who has input on priorities? |

**Listen for:** Budget limitations, staffing constraints, compliance requirements, competing priorities

---

### Section 3: Backend Processes & Operations (10 min)

> *Understand how backend operations affect user experience*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | Walk me through what happens behind the scenes when something goes wrong with the database. | • How quickly do you typically detect issues? • What's the escalation process? |
| 2 | How do you currently monitor database performance and health? | • What metrics matter most? • How do you know when users are affected? |
| 3 | What backend processes run regularly that users never see but might feel the impact of? | • How do these affect app performance? • Any timing considerations? |

**Listen for:** Monitoring capabilities, incident response, maintenance windows, background processes

---

### Section 4: Connecting to User Research (8 min)

> *Share relevant user findings and get stakeholder perspective*

"In our user research, we've heard about performance and reliability issues. From your perspective..."

| Finding | Question |
|---------|----------|
| Users report slow load times during peak hours | "What's happening on the backend during those peak periods that might cause this?" |
| Users experience intermittent data sync issues | "What database processes could lead to sync problems, and how might the new DB address this?" |
| Users lose work when the app crashes | "How does database connectivity relate to app stability, and what safeguards exist?" |

---

### Closing (5 min)

- "What haven't I asked about the database implementation that you think I should know?"
- "Who else should I talk to about technical constraints or backend operations?"
- "What would make this database transition a win from your perspective?"
- "Can I follow up if I have more questions as we move forward?"

**Thank them for their time.**

---

## After the Interview

**Capture immediately:**
- [ ] Key technical constraints and risks mentioned
- [ ] Resource/policy limitations that could impact timeline
- [ ] Backend processes that affect user experience
- [ ] Connections between technical constraints and user pain points
- [ ] Other stakeholders to interview (DevOps, QA, Product, etc.)

---

## Quick Reference

| If they say... | Probe deeper with... |
|----------------|----------------------|
| "It's complicated" | "Walk me through it step by step" |
| "We can't do that" | "What would need to change to make it possible?" |
| "That's not my area" | "Who would know more about that?" |
| "The new DB will fix everything" | "What specific problems will it solve? What new challenges might it create?" |
| "Performance is fine" | "How do you measure that? What would 'not fine' look like?" |

---

### References

This guide follows stakeholder research best practices:

- **Steve Portigal** — "Interviewing Users" (stakeholder interview techniques)
- **Erika Hall** — "Just Enough Research" (internal research methods)
- **Kim Goodwin** — "Designing for the Digital Age" (stakeholder alignment)

---

*Generated by Qori*
