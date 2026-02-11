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
> **Bottom Line:** Critical accessibility violations and navigation inefficiencies are preventing Veterans from completing essential health and benefits tasks, requiring immediate fixes to button labeling and information architecture.

### Key Takeaways

| Priority | Finding | Impact | Action Required |
|:--------:|:--------|:-------|:----------------|
| 🔴 | Unlabeled buttons block task completion for screen reader users | Complete accessibility barriers preventing Veterans from using core app functions | Audit and fix all button accessibility labels |
| 🟡 | Claims status buried too deep for daily users | Power users waste time navigating 5+ taps for most-checked information | Elevate claims status to customizable home screen |
| 🟢 | Logical main menu structure aligns with user expectations | Veterans can navigate Health, Benefits, Payments, Profile intuitively | Maintain current navigation categories |

---

## 🎯 Research Overview

### Why We Conducted This Research

This research informed the VA product team's decision on which navigation improvements to prioritize for the mobile app redesign in Q1 2026, specifically focusing on main menu restructuring, search functionality enhancements, and information hierarchy changes. The findings help Veterans complete health and benefits tasks more efficiently by creating clearer pathways to essential services like appointment scheduling, prescription refills, and disability claim tracking.

### Research Objectives

- **Identify** specific navigation and information architecture issues that contribute to the 45% task abandonment rate
- **Understand** veteran mental models for organizing health and benefits services within the mobile app
- **Evaluate** current task completion flows across health and benefits features for usability barriers
- **Prioritize** actionable design solutions to improve user satisfaction rating from 4.2/10 to above 7/10

### Research Questions

1. What navigation pain points cause users to abandon critical tasks like appointment scheduling and disability claim status checks?
2. How do veterans expect to navigate health and benefits tasks compared to other government and healthcare mobile applications?
3. Which information architecture improvements would reduce task completion time by 30% and increase successful task completion rates?
4. What are the top 5 navigation issues that directly impact veteran ability to access essential VA services?

---

## 📊 Findings at a Glance

<table>
<tr>
<td width="33%" valign="top">

### 🔴 Critical Issues
**4 findings**

- Unlabeled buttons block screen reader users
- Claims status requires excessive navigation
- Search function completely fails
- Session timeouts disrupt active use

</td>
<td width="33%" valign="top">

### 🟡 Improvements Needed
**4 findings**

- Touch targets too small for motor accessibility
- Technical jargon confuses users
- Inconsistent text scaling implementation
- Messages location doesn't match mental models

</td>
<td width="33%" valign="top">

### 🟢 Working Well
**3 findings**

- Main navigation structure is logical
- Home screen appointments provide quick access
- Prescription management section is accessible

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

Multiple buttons throughout the interface were announced only as "Button" by VoiceOver, providing no indication of their function or purpose. This prevented the screen reader user from completing tasks efficiently and created fundamental accessibility violations that blocked core app functionality.

#### Supporting Evidence

> "There's a button that just says 'Button' without any descriptive text. That's not helpful at all."
> 
> — **PT001** *Marine veteran using VoiceOver*

> "I shouldn't have to guess what buttons do. That's basic accessibility."
> 
> — **PT001** *Expressing frustration during task attempt*

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

**Suggested Action:** Conduct comprehensive audit of all interactive elements and implement descriptive accessibility labels for every button, link, and control

**Rationale:** This addresses fundamental WCAG compliance issues and enables Veterans with visual impairments to use essential app functions

**Owner:** Development Team + Accessibility Specialist

**Effort Estimate:** Medium

</details>

---

### Finding 2: Claims Status Buried Too Deep for Daily Users

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The daily user had to navigate through multiple menu levels and tap 5 times to reach claims status information, despite checking this information every day. This creates significant friction for power users who rely on the app for critical benefit tracking.

#### Supporting Evidence

> "Why is claims under Benefits and not on the main screen? I check that every day."
> 
> — **PT002** *Army veteran expressing navigation frustration*

> "I had to tap like five times to get to my claim status."
> 
> — **PT002** *Describing excessive navigation effort*

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

**Suggested Action:** Add claims status widget to customizable home screen and enable users to prioritize their most-used features

**Rationale:** Reduces navigation friction for daily tasks and aligns with user expectations from banking and other service apps

**Owner:** Product Team + UX Design

**Effort Estimate:** High

</details>

---

### Finding 3: Search Function Completely Fails for Common Queries

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The search feature failed to return useful results for common queries like "claim," forcing the participant to abandon search entirely and navigate manually. This represents a complete failure of a critical discovery mechanism.

#### Supporting Evidence

> "The search doesn't find what I'm looking for. I typed 'claim' and got nothing useful."
> 
> — **PT002** *Describing search failure during task*

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

**Suggested Action:** Redesign search functionality to include contextual results for common VA terms and implement predictive search capabilities

**Rationale:** Provides alternative navigation path when menu structure fails and matches user expectations for modern app search

**Owner:** Engineering Team + Content Strategy

**Effort Estimate:** High

</details>

---

### Finding 4: Session Timeouts Disrupt Active Use

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Session timeout occurred twice during active use, with the second instance causing loss of a secure message draft that had to be restarted. This creates significant frustration and task failure for users who need more time to complete complex tasks.

#### Supporting Evidence

> "Why does this keep logging me out? I was just using it an hour ago."
> 
> — **PT003** *Navy veteran expressing frustration after losing message draft*

</td>
<td width="30%" valign="top">

**Severity**

`🔴 CRITICAL`

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

**Suggested Action:** Extend session timeout duration for active users and implement draft saving functionality for forms and messages

**Rationale:** Prevents data loss and accommodates users who need more time due to accessibility needs or complex tasks

**Owner:** Engineering Team + Security Team

**Effort Estimate:** Medium

</details>

---

### Finding 5: Touch Targets Too Small for Motor Accessibility

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The participant with fine motor control difficulties experienced 3 miss-taps during the session and moved slowly and deliberately when attempting to tap buttons due to their small size. This creates physical strain and reduces confidence in app interaction.

#### Supporting Evidence

> "I need bigger buttons. These are hard to tap with my fingers."
> 
> — **PT003** *Navy veteran requesting larger touch targets*

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

**Suggested Action:** Increase minimum touch target sizes to meet accessibility guidelines (44x44 points minimum)

**Rationale:** Improves usability for Veterans with motor impairments and reduces interaction errors

**Owner:** UX Design Team

**Effort Estimate:** Medium

</details>

---

### Finding 6: Technical Jargon Confuses Users About Claim Progress

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Technical terminology like "Evidence gathering" created uncertainty about claim status and next steps, causing anxiety for the user who couldn't determine if this status was positive or negative progress.

#### Supporting Evidence

> "I don't understand what 'Evidence gathering' means. Is that good or bad?"
> 
> — **PT002** *Army veteran expressing confusion about claim status terminology*

</td>
<td width="30%" valign="top">

**Severity**

`🟡 HIGH`

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

**Suggested Action:** Replace technical jargon with plain language explanations and add contextual help for status meanings

**Rationale:** Reduces user anxiety and provides clear understanding of claim progress and next steps

**Owner:** Content Strategy + UX Writing

**Effort Estimate:** Low

</details>

---

### Finding 7: Inconsistent Text Scaling Undermines Accessibility Features

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Even with large text setting enabled, some UI elements didn't scale properly, including buttons, icons, and input fields, forcing the participant to strain to read content despite having accessibility settings configured.

#### Supporting Evidence

> "Text is still too small in some places even with the large text setting."
> 
> — **PT003** *Navy veteran noting accessibility implementation gaps*

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

**Suggested Action:** Audit and fix text scaling implementation across all UI components to ensure consistent accessibility support

**Rationale:** Ensures accessibility features work as intended and provides reliable support for users with vision impairments

**Owner:** Development Team + Accessibility Specialist

**Effort Estimate:** Medium

</details>

---

## ✅ What's Working Well

> [!TIP]
> These elements should be preserved and potentially expanded in future iterations.

| Positive Finding | Evidence | Participant(s) |
|:-----------------|:---------|:---------------|
| **Logical Main Menu Structure** | "The main menu structure makes sense - Health, Benefits, Payments
