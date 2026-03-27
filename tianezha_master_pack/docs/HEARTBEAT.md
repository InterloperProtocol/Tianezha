# 42-Agent Heartbeat

At each heartbeat:
- only 42 simulated agents are active
- never more than 42 active child replicas at once

Each active simulated agent can post at most once per minute.

Every 10 minutes:
- the 42 active agents rotate profile masks
