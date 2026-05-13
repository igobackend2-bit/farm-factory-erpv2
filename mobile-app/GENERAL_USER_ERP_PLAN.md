# General User ERP Alignment Plan

## Goal
Align General User experience with ERP workflow across Home, Work, Requests, and More tabs.

## Scope
1. Work flow is focused on 3 primary screens: Day Plan, Hourly Report, EOD Summary.
2. Day Plan captures only task list (remove expected output, dependencies, work type from UI).
3. Hourly Report supports selecting Day Plan task + submitting work notes per time slot.
4. Home Start/End Day no longer depends on selfie capture.
5. Thirukural section UI is simplified and made consistent.
6. Home workspace shortcuts are removed.
7. Requests landing provides 3 direct actions: Leave Request, Payment Request, Travel Request.
8. More navigation includes EOD Summary and Diagnostics.

## Implementation Checklist
- [ ] Update navigation routes for General User Work/Requests/More flow.
- [ ] Add RequestsHomeScreen with 3 request actions.
- [ ] Simplify DayPlanScreen form and submit logic.
- [ ] Rework HourlyPlanReportScreen to task selection + work notes flow.
- [ ] Remove selfie gating from Home start day logic and remove shortcuts UI.
- [ ] Refresh Thirukural card layout for readability.
- [ ] Add EOD Summary route in More stack and menu routing.
- [ ] Run static error check for edited files.

## Validation
- General user can start/end day without selfie workflow blocks.
- Work tab supports Day Plan, Hourly Report, EOD Summary flow.
- Hourly report submission enforces selected task and notes.
- Requests tab opens 3 request actions screen.
- More tab can open EOD Summary and Diagnostics.
