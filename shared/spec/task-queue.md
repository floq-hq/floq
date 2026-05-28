# shared/spec/task-queue.md

The **user-task feature** — how a user captures what they want to do, how those tasks are stored and prioritized, and how exactly one is surfaced at a time to feed the focus timer.

> Naming note: this file is about the user's *to-do items*. It is **not** `tasks.md` (that's the project work-breakdown / sprint plan). Different "tasks."

## Relationship to other specs (don't duplicate — these stay canonical)

- **`session-flow.md`** owns the behavioral rules: "only one task visible at a time" (rule #1) and the **§Task promotion** sequence (remove on Done → auto-promote next). This file references them; it does not restate or override them.
- **`schema.md`** owns the Firestore shape of `users/{uid}/tasks/{taskId}` (mirror), and the `floq-firestore` skill owns its access rules. This file owns the *in-app* `Task` type and the local store.
- **`decisions.md` L14** is the decision of record for this feature (creation paths, CRUD, ownership, phasing). **L10 / L12** govern the LLM that powers brain-dump.
- **`design-system.md`** owns the visual treatment of every surface named here.

If anything below appears to conflict with those files, they win — surface the conflict per root `CLAUDE.md`.

## Why this feature exists

The product premise is *low cognitive load*: the user dumps everything on their mind, the LLM splits it into discrete tasks, and the app shows **one** at a time so the user commits instead of re-deciding. The hidden tasks still exist and are prioritized — they just aren't on screen during work.

## The task model

In-app type (source of truth in the store; the Firestore mirror in `schema.md` uses snake_case):

```ts
type Task = {
  id: string;
  title: string;          // PRIVATE — never leaves the device to a partner / `social` (L4)
  difficulty: 1 | 2 | 3 | 4 | 5;
  estMinutes: number;
  order: number;          // queue position; lower = higher priority; 0 = top/visible task
  done: boolean;          // defaults false
  createdAt: number;      // epoch ms
};
```

`difficulty` and `estMinutes` are the fields the timer consumes at session start (see `timer.md` / `computeSessionPlan`). They originate from the LLM parse (`ParsedTask`) or manual entry.

## Capture — two co-equal creation paths (L14)

Both are **first-class**. Manual entry is *not* an LLM-failure fallback; it is deliberately present but visually understated.

1. **LLM brain-dump (primary, prominent).** Free text → `parseTasks()` (M2.3, providers per L10/L12) → `ParsedTask[]` → user reviews/reorders → `useTaskStore.addTasks()`.
2. **Manual entry (understated).** A single task typed by hand via `ManualTaskForm` (title + duration picker + difficulty buttons) → `useTaskStore.addTask()`. The *same* `ManualTaskForm` is what the brain-dump modal shows if the LLM parse/rate-limit fails — one component, two entry points.

## Prioritization & the one-visible rule

- Tasks live in a single ordered queue. `order` defines priority; the task at the top (`order` minimum) is the **visible task** on Home.
- The user reorders by dragging (in the freshly-parsed list pre-save, and in the management sheet for saved tasks).
- Home shows only the top task plus a **`+N hidden`** caption. Hidden tasks are queried on demand, never preloaded (root `CLAUDE.md` convention). The "force commitment" rationale is preserved because the user can't browse the queue mid-session — see `session-flow.md`.

## CRUD surface

All operations go through `useTaskStore` (never directly from a screen). Pure queue math lives in `services/tasks/queue.ts`.

| | Operation | Store API |
|---|---|---|
| **C** | LLM batch | `addTasks(ParsedTask[])` |
| **C** | single manual | `addTask(input)` |
| **R** | visible task | `topTask` selector |
| **R** | hidden count | `hiddenCount` selector |
| **U** | edit fields | `updateTask(id, { title?, difficulty?, estMinutes? })` |
| **U** | reprioritize | `reorder(fromOrder, toOrder)` |
| **U** | complete | `markDone(id)` |
| **D** | remove | `removeTask(id)` |

## Lifecycle

- On **Done** (S3.3): `markDone(topTaskId)` sets `done: true`, removes the task from the active queue, and **auto-promotes** the next task to the top — exactly as `session-flow.md` §Task promotion specifies. If the queue is then empty, Home shows the brain-dump prompt.
- Completed tasks are not shown in the active queue. (Whether/where to surface a "done today" history is **post-MVP** — see Out of scope.)

## Persistence (phased — L14)

The store API is stable across both phases; only the backing store changes.

- **W2 (M2.5):** Zustand `useTaskStore` backed by an MMKV atomic blob `floq.tasks` (same pattern as onboarding, M2.2). MMKV is the source of truth. Survives app kill.
- **W4 (M4.2):** SQLite (`services/storage/tasks.ts`) becomes the source of truth; MMKV demotes to a fast-read cache. Tasks mirror **async** to Firestore `users/{uid}/tasks` (owner-only) for cross-device sync.

**Privacy invariant (L4):** task titles never leave the device to a partner or the `social` doc. The Firestore mirror is readable only by the owner.

## Surfaces

- **Home** — the visible top-task card (title + est-minutes pill + difficulty pill), the `+N hidden` caption, and the `+` entry that opens capture. (Layout in `mobile/CLAUDE.md` → Screen-specific notes → Home.)
- **`BrainDumpModal`** — free-text capture + parsed-list review (S2.4).
- **`ManualTaskForm`** — single-task hand entry; shared by manual add and the LLM-failure path (S2.4 builds it, S2.6 reuses it).
- **`TaskQueueSheet`** — opened from the `+N hidden` caption; the full-queue management view (edit / delete / reorder) plus the understated "add manually" affordance (S2.6).

## Out of scope for MVP (candidates for a later decision)

Recurring tasks, due dates / scheduling, subtasks or checklists, tags/projects, a completed-task history view, cross-task search. None are built unless a new `decisions.md` entry adds them.

## Owning work items (`tasks.md`)

- **M2.3** — `parseTasks()` LLM service (capture path 1).
- **M2.5** — task store + pure queue + MMKV persistence + full CRUD (the data layer).
- **S2.4** — brain-dump modal, parsed list, `ManualTaskForm`.
- **S2.6** — `TaskQueueSheet`, understated manual add, management UI.
- **S3.3** — Done wiring (`markDone` → promote).
- **M4.2** — SQLite source of truth + Firestore mirror.
