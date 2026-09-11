# Architecture

Customer
   ↓
Procol Brain
   ↓
Agent Orchestrator
   ↓
 ┌───────────────┬──────────────┐
 ↓               ↓              ↓
Clara          Dev Agent      QA Agent
 ↓               ↓              ↓
Knowledge      GitHub         Test Runner


Agent communication:
A2A

Agent tools:
MCP

External systems:
Connectors