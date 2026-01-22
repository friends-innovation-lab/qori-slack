# 🏛️ Stakeholder Interview Guide

> **Study:** Qori Testing | **Role:** Engineering Lead | **Duration:** 45 minutes

---

## Overview

| | |
|---|---|
| **Stakeholder** | Engineering Lead from Mobile team |
| **Focus Area** | Technical constraints, policy limitations, resource bottlenecks, and backstage operations |
| **Goal** | Understand technical and operational constraints that impact mobile app development and user experience, plus how backend processes affect what users see |

---

## Before the Interview

**Review these materials:**
- [ ] Current mobile app architecture documentation
- [ ] Recent user feedback about app performance/functionality
- [ ] Any existing technical debt or constraint documentation

**Key user findings to explore:**
- User complaints about app slowness or crashes
- Features users request that haven't been implemented
- User confusion about app behavior or limitations

---

## Interview Guide

### Opening (3-5 min)

> *Build rapport and set context*

- Thanks for taking the time. I'm researching mobile app constraints and wanted to understand the technical landscape better.
- Everything you share helps us design better solutions. No wrong answers.
- Okay to record? [If applicable]

**Opener:** "To start, can you tell me about your role as Engineering Lead and how you oversee mobile development?"

---

### Section 1: Technical Constraints (15 min)

> *Understand technical limitations affecting mobile development*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | What are the biggest technical constraints your mobile team faces right now? | • How do these impact development timelines? • Which constraint causes the most user-facing issues? |
| 2 | Walk me through your current mobile architecture - what works well and what doesn't? | • Where are the bottlenecks? • What would you rebuild if you could start over? |
| 3 | How do platform differences (iOS vs Android) create constraints for your team? | • Which platform is more challenging to develop for? • How do you handle feature parity? |
| 4 | What technical debt is affecting your ability to ship new features? | • How did this debt accumulate? • What's the impact on user experience? |

**Listen for:** Specific technical pain points, infrastructure limitations, platform-specific challenges, legacy system dependencies

---

### Section 2: Resource & Policy Constraints (12 min)

> *Understand non-technical constraints affecting mobile development*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | How do resource constraints (team size, budget, time) affect what you can build? | • What gets deprioritized because of resource limits? • How do you make trade-off decisions? |
| 2 | What policy or compliance requirements shape your mobile development decisions? | • Which policies create the most friction? • How do these affect user experience? |
| 3 | How do dependencies on other teams create constraints for mobile development? | • Which team dependencies cause the most delays? • How do you work around these bottlenecks? |

**Listen for:** Resource allocation challenges, regulatory requirements, cross-team dependencies, approval processes

---

### Section 3: Backstage Operations & Processes (10 min)

> *Understand behind-the-scenes processes that affect user experience*

| # | Question | Follow-ups |
|---|----------|------------|
| 1 | Walk me through how a new mobile feature goes from idea to user's phone. | • Where do delays typically happen? • What approvals are required? |
| 2 | How do you handle mobile app updates and releases? | • What constraints affect your release schedule? • How do you manage rollbacks or emergency fixes? |
| 3 | What happens behind the scenes when users report bugs or issues? | • How do you prioritize which issues to fix? • What's your process for reproducing user problems? |

**Listen for:** Development workflows, release processes, QA procedures, incident response

---

### Section 4: Connecting to User Research (8 min)

> *Share relevant user findings and get stakeholder perspective*

"In our user research, we heard [finding]. From your perspective..."

| Finding | Question |
|---------|----------|
| Users report the app is slow or crashes frequently | "What technical factors contribute to performance issues users experience?" |
| Users get confused when features work differently than expected | "What constraints lead to unexpected app behavior from a user's perspective?" |
| Users request features that seem simple but haven't been implemented | "When users ask for seemingly simple features, what complexity are they not seeing?" |

---

### Closing (5 min)

- "What constraints haven't I asked about that significantly impact your mobile development?"
- "Who else should I talk to to better understand mobile app limitations - backend engineers, DevOps, product managers?"
- "Can I follow up if I have more questions as I analyze user feedback?"

**Thank them for their time.**

---

## After the Interview

**Capture immediately:**
- [ ] Key technical constraints mentioned
- [ ] Resource/policy limitations identified
- [ ] Process bottlenecks discovered
- [ ] Connections between constraints and user pain points
- [ ] Other stakeholders to interview (backend, DevOps, etc.)

---

## Quick Reference

| If they say... | Probe deeper with... |
|----------------|----------------------|
| "It's complicated" | "Walk me through the technical complexity step by step" |
| "We can't do that" | "What technical or resource changes would make it possible?" |
| "That's not my area" | "Which team or person would know more about that constraint?" |
| "Users don't understand" | "What technical limitations cause that user confusion?" |

---

### References

This guide follows stakeholder research best practices:

- **Steve Portigal** — "Interviewing Users" (stakeholder interview techniques)
- **Erika Hall** — "Just Enough Research" (internal research methods)
- **Kim Goodwin** — "Designing for the Digital Age" (stakeholder alignment)

---

*Generated by Qori •*
