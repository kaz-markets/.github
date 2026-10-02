---
type: reference
title: "Task tracking"
description: "Where work is tracked, what belongs where, and the rule that keeps notifications from pinging people."
owner: dan
tags: [process, tasks, notifications, github-projects]
timestamp: 2026-10-02T05:22:27Z
code: []
---

# Task tracking

## Where work lives

| What | Where | Why |
|---|---|---|
| Code tasks for the KAZ repositories | The org Project, <https://github.com/orgs/kaz-markets/projects/1> | Free, native to the repositories, and a pull request can link to what it closes |
| The work itself | Issues in the repository it belongs to | An issue that does not name a repository cannot be picked up |
| State of the world right now | `STATUS.md` in the repository | Volatile, rewritten every session. Not the project board |
| What something is and how it works | `docs/`, the OKF bundle | The board tracks work, not knowledge. A question answered is a doc, not a ticket |

The Project is the board. It is not a second source of truth: anything durable belongs in
`docs/`, and anything true only today belongs in `STATUS.md`.

## The board

One Project in the `kaz-markets` organization, linked to `kaz-control`, `kaz-socket` and
`prediction-markets-report`. Linked repositories are what let an issue or a pull request
appear on the board without anyone dragging it there.

Its epics are the cutover phases from `kaz-control/docs/backend/migration.md`, because that
file already decomposes the work and already states that each phase is independently
revertible by flipping its flag. The phases are seeded as draft items. Promote one to an
issue in the repository it belongs to when it becomes real work.

Linear is not used for these repositories. It stays where it is already in use.

## Notifications

A GitHub Action may post into Google Chat through an incoming webhook. Two limits, both
hard:

- **One-way only.** An incoming webhook is a notification, not a bot. An interactive Chat
  app is a third-party surface and does not get added.
- **No mentions, ever.** No `@here`, no `@channel`, no naming a person, and no message whose
  purpose is to ask someone to review, approve or merge. A notification says what changed. It
  does not chase a human. This is the `never-ping-people` rule and it applies to machine
  notifications exactly as it applies to an agent.

The webhook URL is a credential: anyone holding it can post into the space. It is a secret,
set per repository, and never written into a workflow file, a doc or a chat message.

## What is not here

The notification workflow is not built. The board and this document are; the webhook is
deliberately absent until a space exists and the URL can be stored as a secret.
