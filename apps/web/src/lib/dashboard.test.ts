import assert from 'node:assert/strict'
import test from 'node:test'

import { eventTypeLabel, loadDashboardData } from '@/lib/dashboard'

test('loadDashboardData falls back to local mock data when fetch fails', async () => {
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async () => {
        throw new Error('offline')
    }) as typeof fetch

    try {
        const payload = await loadDashboardData()

        assert.equal(payload.usingMockData, true)
        assert.ok(payload.events.length > 0)
        assert.ok(payload.zones.length > 0)
        assert.ok(payload.timeline.length > 0)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('eventTypeLabel formats known event types', () => {
    assert.equal(eventTypeLabel('airstrike'), 'Airstrike')
    assert.equal(eventTypeLabel('naval'), 'Naval')
})