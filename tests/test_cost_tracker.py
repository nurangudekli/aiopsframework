"""Tests for the cost tracker service."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone

from backend.services.cost_tracker import (
    _cost_alerts,
    clear_cost_alerts,
)


def test_clear_cost_alerts_empty():
    """clear_cost_alerts on empty list returns 0."""
    _cost_alerts.clear()
    count = clear_cost_alerts()
    assert count == 0


def test_clear_cost_alerts_with_items():
    """clear_cost_alerts returns count and clears."""
    _cost_alerts.clear()
    _cost_alerts.append({"type": "test", "triggered_at": datetime.now(timezone.utc).isoformat()})
    _cost_alerts.append({"type": "test", "triggered_at": datetime.now(timezone.utc).isoformat()})
    count = clear_cost_alerts()
    assert count == 2
    assert len(_cost_alerts) == 0
