# Paper Trade Lifecycle Engine

Phase 2A adds an event-driven, paper-only lifecycle around the Phase 1 trade journal. It does not call or modify signal generation, evidence accumulation, risk scoring, decision logic, position sizing, or the aggregate backtest.

## Components

- `src/lib/trading/lifecycleEvent.ts`: lifecycle states and immutable event shape.
- `src/lib/trading/lifecycleEventRepository.ts`: append/read contract for lifecycle events.
- `src/lib/trading/fileLifecycleEventRepository.ts`: persistent JSONL lifecycle journal.
- `src/lib/trading/orderManager.ts`: order quantity and order-status accounting.
- `src/lib/trading/positionManager.ts`: filled quantity, weighted average price, costs, and direction-aware PnL.
- `src/lib/trading/tradeLifecycle.ts`: state machine coordinator and Phase 1 journal integration.

## State flow

```text
SIGNAL_GENERATED
 -> TRADE_PROPOSED
 -> RISK_VALIDATED
 -> ORDER_CREATED
 -> ORDER_PENDING
 -> ORDER_PARTIALLY_FILLED (when applicable)
 -> POSITION_OPEN
 -> POSITION_UPDATED (additional fills)
 -> ORDER_FILLED
 -> POSITION_CLOSED
 -> TRADE_COMPLETED
```

Risk rejection produces `TRADE_REJECTED`. Cancelling before a fill produces `ORDER_CANCELLED`. Cancelling after a partial fill produces `ORDER_CANCELLED` followed by `POSITION_REMAINS_OPEN`; it does not create a completed trade or close the filled position.

## Journal behavior

Every state transition is appended as a `LifecycleEvent` to `data/paper-lifecycle-events.jsonl` by default. Event IDs and lifecycle sequence numbers are unique within the journal. Existing events are never rewritten, and duplicate IDs/sequences are rejected.

After a valid position close, the engine creates exactly one Phase 1 `TradeRecord` with the weighted-average entry price, actual filled quantity, direction-aware gross PnL, accumulated costs, exit reason, and proposal evidence/regime fields. The trade is written before the `TRADE_COMPLETED` lifecycle event is appended.

## Safety and limitations

This is paper lifecycle infrastructure only. It does not simulate execution, create broker orders, fetch prices, or choose entries/exits. Phase 2B will supply execution fills and costs through this engine. The current implementation is an in-process coordinator and the JSONL repositories do not provide cross-process locking or transactional database semantics.
