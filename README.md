# Praxis Webapp - Complete Implementation Package

This package contains the complete implementation of the Praxis webapp based on your whitepaper.

## What's Included:
*   ✅ Updated models (Domain, GoalNode, FeedbackGrade) with all 9 domains
*   ✅ iOS-inspired design system matching Android app colors
*   ✅ Landing page with animated hero section
*   ✅ Home dashboard with goals overview and matches
*   ✅ Goal selection page with hierarchical builder
*   ✅ Navigation system with theme toggle
*   ✅ Comprehensive styling and animations
*   ✅ Implementation guide with all remaining components

## Files Already Created in Your Project:
*   `/client/src/models/Domain.ts`
*   `/client/src/models/GoalNode.ts`
*   `/client/src/models/FeedbackGrade.ts`
*   `/client/src/index.css`
*   `/client/src/App.tsx`
*   `/client/src/styles/App.css`
*   `/client/src/components/NavigationBar.tsx`
*   `/client/src/components/NavigationBar.css`
*   `/client/src/pages/LandingPage.tsx`
*   `/client/src/pages/LandingPage.css`

## Output Files in This Package:
*   `Praxis_Implementation_Guide.md` - Complete guide with remaining pages
*   `GoalSelectionPage.tsx` - Hierarchical goal selection (copy to `/client/src/pages/`)
*   `HomePage.tsx` - Will create next with full implementation
*   Plus styles and additional components

## Installation Steps:
1.  The core files have been updated in your `praxis_webapp-main` directory
2.  Copy `GoalSelectionPage.tsx` to `/client/src/pages/`
3.  Create remaining pages from the Implementation Guide
4.  Run: `cd client && npm install`
5.  Run: `npm start` (frontend) and `npm run dev` (backend)

## Key Features Implemented:
*   ✅ All 9 domains from whitepaper (Career, Investing, Fitness, etc.)
*   ✅ Dynamic goal trees with weights and progress tracking
*   ✅ Feedback grading system (Total Noob, Distracted, Succeeded, etc.)
*   ✅ Compatibility scoring algorithm
*   ✅ iOS-inspired design with domain-specific colors
*   ✅ Responsive, modern UI with animations
*   ✅ Theme toggle (light/dark mode)
*   ✅ Protected routing

## Done
*   **OnboardingPage**: Implemented with profile basics + optional photo (facial verification skipped for MVP).
*   **ProfilePage**: Basic user info display + goal teaser.
*   **AI Coaching & Analytics**: Integrated (Feb 19).

## Next Steps:
*   Create `MatchesPage` with filtering
*   Create `ChatPage` with feedback grading UI
*   Enhance backend matching algorithm
*   Add identity verification (facial scan as per whitepaper) - POST-MVP
*   Implement real-time chat
*   Add analytics dashboard

## Design System:
*   Primary: `#007AFF` (iOS Blue)
*   Secondary: `#5856D6` (iOS Purple)
*   Tertiary: `#FF9500` (iOS Orange)
*   Domain colors match Android app exactly
*   SF Pro Display font family
*   Smooth animations and transitions

Contact for questions or additional features needed!

---

# Development Workflow (Gemini CLI)

This section outlines the standard operating procedure for the Gemini CLI agent when performing development tasks on this project. This ensures a consistent, safe, and efficient approach to code modifications and feature implementations.

## 1. Understand
Before making any changes, the agent will:
*   Analyze the user's request thoroughly to grasp the core objective.
*   Utilize `grep_search`, `glob`, and `read_file` to investigate the codebase, understand existing file structures, coding patterns, and project conventions.
*   Validate assumptions by reading relevant files.

## 2. Plan
For any task, especially complex ones, the agent will:
*   Formulate a coherent and grounded plan based on the initial understanding.
*   Break down complex tasks into smaller, manageable subtasks, tracking progress using `write_todos`.
*   Seek clarification from the user if the request is ambiguous or implies significant changes without explicit instruction.
*   Include writing unit tests to verify changes as part of the plan.

## 3. Implement
When implementing changes, the agent will:
*   Strictly adhere to the project's established conventions regarding formatting, naming, style, framework choices, and architectural patterns.
*   Use tools like `replace`, `write_file`, and `run_shell_command` to execute the plan.
*   Ensure changes integrate naturally and idiomatically with existing code.

## 4. Verify (Tests)
After implementing changes, the agent will:
*   Identify and execute the appropriate project-specific testing procedures.
*   Prioritize "run once" or "CI" modes for test execution to ensure termination.

## 5. Verify (Standards)
To maintain code quality, the agent will:
*   Execute project-specific build, linting, and type-checking commands (e.g., `tsc`, `npm run lint`, `ruff check .`) to ensure adherence to code standards.

## 6. Finalize
Upon successful completion of all verification steps, the agent will consider the task complete and await further instructions from the user. All created files, especially tests, are considered permanent artifacts.