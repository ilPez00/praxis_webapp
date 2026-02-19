# Praxis Webapp - Complete Implementation Package

This package contains the complete implementation of the Praxis webapp based on your whitepaper.

## Implemented Features:
*   **OnboardingPage**: Implemented with profile basics and optional photo.
*   **ProfilePage**: Basic user info display and goal teaser.
*   **MatchesPage**: Filtering and matching algorithms implemented.
*   **ChatPage**: Real-time chat with feedback grading UI implemented.
*   **GoalTree**: Dynamic goal trees with weights and progress tracking.
*   **Analytics Dashboard**: Integrated with AI Coaching.
*   **Identity Verification**: Implemented, including facial scan for MVP.
*   **Stripe Integration**: Payment processing integrated.

## Current Tech Stack:
*   **Frontend**: React, TypeScript
*   **Backend**: Node.js, Express.js, TypeScript
*   **Database & Auth**: Supabase

## Architecture Overview:
The application follows a client-server architecture:
*   The `client/` directory contains the React frontend application, responsible for the user interface and interactions.
*   The `src/` directory at the project root contains the Node.js/Express.js backend API, handling business logic, database interactions, and authentication.
*   Communication between the frontend and backend occurs via RESTful API calls.
*   Supabase is used for database management and user authentication.

## Environment Variables:
To run this project, you will need to set up environment variables. Create a `.env` file in the root of the project for backend variables and a `.env.local` file in the `client/` directory for frontend variables.

**Backend (.env example):**
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
STRIPE_SECRET_KEY=your_stripe_secret_key
JWT_SECRET=your_jwt_secret
```

**Frontend (client/.env.local example):**
```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_STRIPE_PUBLIC_KEY=your_stripe_public_key
```

**Note:** The `REACT_APP_` prefix is required for Create React App to expose variables to the browser.

## Consistent Error Toasts:
The application uses `react-hot-toast` for user feedback. To ensure a consistent user experience:
*   Always use `react-hot-toast` for displaying notifications (success, error, loading).
*   For error messages, consider a centralized utility or custom hook (e.g., `useToast` or `toastUtils.ts`) to wrap `react-hot-toast` calls. This allows for consistent styling, icons, and duration across the application.
*   Example: `toast.error('An unexpected error occurred. Please try again.');`

## Key Features Implemented:
*   ✅ All 9 domains from whitepaper (Career, Investing, Fitness, etc.)
*   ✅ Dynamic goal trees with weights and progress tracking
*   ✅ Feedback grading system (Total Noob, Distracted, Succeeded, etc.)
*   ✅ Compatibility scoring algorithm
*   ✅ iOS-inspired design with domain-specific colors
*   ✅ Responsive, modern UI with animations
*   ✅ Theme toggle (light/dark mode)
*   ✅ Protected routing

## Design System:
*   Primary: `#007AFF` (iOS Blue)
*   Secondary: `#5856D6` (iOS Purple)
*   Tertiary: `#FF9500` (iOS Orange)
*   Domain colors match Android app exactly
*   SF Pro Display font family
*   Smooth animations and transitions

## Mobile Testing Checklist:
To ensure the application works flawlessly on mobile devices, consider the following:
*   **Responsiveness:** Verify layouts adapt correctly to different screen sizes and orientations (portrait/landscape).
*   **Touch Interactions:** Test all clickable elements, gestures (swipe, pinch), and scrolling behavior.
*   **Performance:** Check loading times, animation smoothness, and overall app responsiveness on mobile networks and devices.
*   **Form Inputs:** Ensure keyboards appear correctly, input fields are accessible, and auto-correction/suggestions work as expected.
*   **Browser Compatibility:** Test on various mobile browsers (Safari on iOS, Chrome on Android, etc.).
*   **Accessibility:** Check for proper focus management, contrast ratios, and screen reader compatibility.

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