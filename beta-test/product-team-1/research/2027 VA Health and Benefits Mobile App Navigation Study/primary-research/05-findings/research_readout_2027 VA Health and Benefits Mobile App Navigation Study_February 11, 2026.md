<div align="center">

# 📊 Research Report
## 2027 VA Health and Benefits Mobile App Navigation Study

**February 11, 2026**

---

| Participants | Sessions | Methodology | Lead Researcher |
|:------------:|:--------:|:-----------:|:---------------:|
| 3 | 3 | Usability Testing | lapedra@cityfriends.tech |

</div>

---

## 📌 Executive Summary

> [!IMPORTANT]
> **Bottom Line:** Critical accessibility violations and navigation inefficiencies are blocking Veterans from completing essential health and benefits tasks, requiring immediate fixes to button labeling and information architecture.

### Key Takeaways

| Priority | Finding | Impact | Action Required |
|:--------:|:--------|:-------|:----------------|
| 🔴 | Unlabeled buttons prevent task completion for screen reader users | Complete accessibility barriers for disabled Veterans | Audit and fix all button accessibility labels |
| 🟡 | Claims status buried in navigation despite daily usage | Daily friction for power users checking critical information | Elevate claims status to home screen |
| 🟢 | Logical menu structure and prescription management work well | Veterans can navigate efficiently when labels are clear | Maintain and expand successful patterns |

---

## 🎯 Research Overview

### Why We Conducted This Research

This research informed the VA product team's decision on which navigation improvements to prioritize for the mobile app redesign in Q1 2026, specifically focusing on main menu restructuring, search functionality enhancements, and information hierarchy changes to address the 45% task abandonment rate and improve user satisfaction from 4.2/10 to above 7/10.

### Research Objectives

- **Identify** specific navigation and information architecture issues that contribute to task abandonment
- **Understand** veteran mental models for organizing health and benefits services  
- **Evaluate** current task completion flows across health and benefits features
- **Prioritize** actionable design solutions for navigation improvements

### Research Questions

1. What navigation pain points cause users to abandon critical tasks like appointment scheduling and disability claim status checks?
2. How do veterans expect to navigate health and benefits tasks compared to other government and healthcare mobile applications?
3. Which proposed information architecture improvements would reduce task completion time and increase success rates?
4. What are the top 5 navigation issues that directly impact veteran satisfaction with the mobile app?

---

## 📊 Findings at a Glance

<table>
<tr>
<td width="33%" valign="top">

### 🔴 Critical Issues
**4 findings**

- Unlabeled buttons block screen reader users
- Claims status requires excessive navigation
- Search functionality completely fails
- Text scaling inconsistently implemented

</td>
<td width="33%" valign="top">

### 🟡 Improvements Needed
**4 findings**

- Touch targets too small for motor accessibility
- Session timeouts disrupt active tasks
- Technical jargon confuses users
- Important buttons hidden at bottom of screens

</td>
<td width="33%" valign="top">

### 🟢 Working Well
**3 findings**

- Logical main menu structure
- Prescription management section
- Home screen appointment display

</td>
</tr>
</table>

---

## 🔍 Detailed Findings

### Finding 1: Unlabeled Buttons Create Complete Accessibility Barriers

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Multiple buttons throughout the interface were announced only as "Button" by VoiceOver, providing no indication of their function or purpose. This prevented the screen reader user from completing basic tasks and created significant frustration during navigation.

#### Supporting Evidence

> "There's a button that just says 'Button' without any descriptive text. That's not helpful at all."
> 
> — **PT001** *Marine veteran using VoiceOver*

> "I shouldn't have to guess what buttons do. That's basic accessibility."
> 
> — **PT001** *Expressing frustration with unlabeled interface elements*

</td>
<td width="30%" valign="top">

**Severity**

`🔴 CRITICAL`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT001

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Conduct comprehensive audit of all buttons and interactive elements to ensure proper accessibility labels are implemented

**Rationale:** This is a fundamental accessibility requirement that blocks disabled Veterans from using the app

**Owner:** Development Team with Accessibility Lead

**Effort Estimate:** Medium

</details>

---

### Finding 2: Claims Status Buried Despite Daily Usage Needs

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The participant who checks claims status daily had to navigate through multiple menu levels and tap 5 times to reach this critical information. This creates unnecessary friction for one of the most frequently used features by Veterans with pending disability claims.

#### Supporting Evidence

> "Why is claims under Benefits and not on the main screen? I check that every day."
> 
> — **PT002** *Army veteran with pending disability claim*

> "I had to tap like five times to get to my claim status."
> 
> — **PT002** *Describing navigation inefficiency*

</td>
<td width="30%" valign="top">

**Severity**

`🔴 CRITICAL`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT002

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Add claims status widget to customizable home screen for quick access

**Rationale:** Daily usage patterns indicate this should be immediately accessible, not buried in navigation

**Owner:** Product Team

**Effort Estimate:** High

</details>

---

### Finding 3: Search Functionality Completely Fails for Common Queries

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The search feature failed to return useful results for common queries like "claim," forcing the participant to abandon search and navigate manually. This represents a complete failure of a critical discovery mechanism.

#### Supporting Evidence

> "The search doesn't find what I'm looking for. I typed 'claim' and got nothing useful."
> 
> — **PT002** *Attempting to find claims information via search*

</td>
<td width="30%" valign="top">

**Severity**

`🔴 CRITICAL`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT002

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Redesign search to include contextual results for common VA terms and services

**Rationale:** Search should be a reliable fallback when navigation fails, not another dead end

**Owner:** Development Team

**Effort Estimate:** High

</details>

---

### Finding 4: Inconsistent Text Scaling Undermines Accessibility Settings

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Despite having large text settings enabled, some UI elements didn't scale properly, including buttons, icons, and input fields. This forced the participant to strain to read content even with accessibility features activated.

#### Supporting Evidence

> "Text is still too small in some places even with the large text setting."
> 
> — **PT003** *Navy veteran with vision decline*

> "The big text option is helpful. I can actually read this."
> 
> — **PT003** *Noting when text scaling worked properly*

</td>
<td width="30%" valign="top">

**Severity**

`🟡 HIGH`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT003

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Audit and fix text scaling implementation across all UI components

**Rationale:** Inconsistent accessibility features reduce their effectiveness and create user frustration

**Owner:** Development Team

**Effort Estimate:** Medium

</details>

---

### Finding 5: Session Timeouts Disrupt Active Task Completion

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Session timeout occurred twice during the session, with the second instance causing loss of a secure message draft that had to be restarted. This created significant frustration and forced re-authentication during active use.

#### Supporting Evidence

> "Why does this keep logging me out? I was just using it an hour ago."
> 
> — **PT003** *Expressing frustration with session management*

</td>
<td width="30%" valign="top">

**Severity**

`🟡 HIGH`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT003

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Extend session timeout for active users or implement draft saving functionality

**Rationale:** Session interruptions during active use create unnecessary friction and data loss

**Owner:** Development Team

**Effort Estimate:** Medium

</details>

---

## ✅ What's Working Well

> [!TIP]
> These elements should be preserved and potentially expanded in future iterations.

| Positive Finding | Evidence | Participant(s) |
|:-----------------|:---------|:---------------|
| **Logical Main Menu Structure** | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." | PT001 |
| **Prescription Management Section** | "This section actually works pretty well - I can understand what each section contains." | PT001 |
| **Home Screen Appointments** | "I like that my appointments are right on the home screen. That's what I check most." | PT002 |

---

## 👥 Participant Overview

| ID | Context | Key Contribution | Notable Quotes |
|:---|:--------|:-----------------|:---------------|
| **PT001** | Marine veteran using VoiceOver screen reader | Identified critical accessibility violations | "Every button needs a proper label. I shouldn't have to guess what things do." |
| **PT002** | Army veteran, daily app user with pending claim | Highlighted navigation inefficiencies for power users | "I wish I could just have claims on my home screen." |
| **PT003** | Navy veteran with vision decline and motor difficulties | Revealed accessibility implementation gaps | "I need bigger buttons. These are hard to tap with my fingers." |

<details>
<summary><strong>📋 Sample Characteristics</strong></summary>

| Characteristic | Distribution |
|:---------------|:-------------|
| Total Participants | 3 |
| Service Branch | Marine (1), Army (1), Navy (1) |
| Assistive Technology Users | 1 of 3 (33%) |
| Daily App Users | 1 of 3 (33%) |

> [!NOTE]
> Small sample size limits generalizability, but findings reveal critical accessibility and navigation issues that likely affect broader veteran population.

</details>

---

## 🔬 Methodology

| Aspect | Details |
|:-------|:--------|
| **Research Type** | Usability Testing with Card Sorting and Competitive Analysis |
| **Sessions Conducted** | 3 |
| **Session Duration** | 90 minutes (planned) |
| **Research Focus** | Navigation structure, information architecture, search functionality, and task completion flows |
| **Recruitment Method** | Email outreach |
| **Data Collection** | Observer notes, think-aloud protocol, task completion tracking |

---

## 🚀 Recommended Actions

### 🔴 Immediate Priority (Next 2 Weeks)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:-------|:------------------|:------|:------:|
| 1 | **Audit and fix all unlabeled buttons with descriptive accessibility labels** | Unlabeled buttons block task completion | Development Team | M |
| 2 | **Implement consistent text scaling across all UI components** | Text scaling inconsistently implemented | Development Team | M |

### 🟡 Short-Term (1-2 Months)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:
