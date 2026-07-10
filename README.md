# Tool Lending Library CRUD

Ticket: ENG-159708

A React + Vite feature-complete CRUD interface for a floor staff tool lending workflow.

## Features

- Create, read, update, and delete tool records.
- Role checks for manager, staff, and viewer users.
- Local persistence with `localStorage` for spotty connectivity.
- Simulated asynchronous loading states for primary mutations.
- Empty search and list states.
- Form validation with red invalid fields and focus management.
- Text sanitization before state persistence.
- Simulated analytics console messages for completed primary actions.
- Keyboard-accessible controls with ARIA labels and live regions.

## Run

Install and run locally:

```powershell
npm install
npm run dev
```

Then open the local URL shown by Vite.
