export type DashboardEventType =
    | 'airstrike'
    | 'artillery'
    | 'drone'
    | 'naval'
    | 'ground'

export interface DashboardEvent {
    id: string
    title: string
    type: DashboardEventType
    confidence: number
    occurredAt: string
    updatedAt?: string
    lat: number
    lng: number
    locationLabel: string
    zoneId?: string
    sourceCount: number
    sources?: string[]
    summary: string
    status?: string
}

export interface DashboardZone {
    id: string
    name: string
    center: {
        lat: number
        lng: number
    }
    eventCount: number
    avgConfidence: number
    severity: 'low' | 'medium' | 'high'
    heat: number
}

export interface DashboardTimelineBucket {
    bucketStart: string
    total: number
    airstrike?: number
    artillery?: number
    drone?: number
    naval?: number
    ground?: number
}

interface Envelope<T> {
    success?: boolean
    data?: T
}

export interface DashboardPayload {
    events: DashboardEvent[]
    zones: DashboardZone[]
    timeline: DashboardTimelineBucket[]
    usingMockData: boolean
    apiBaseUrl: string
    errors: string[]
}

const DEFAULT_API_BASE_URL = 'http://localhost:3001'

export const mockEvents: DashboardEvent[] = [
    {
        id: 'evt-001',
        title: 'Multiple drone reports near energy corridor',
        type: 'drone',
        confidence: 0.82,
        occurredAt: '2026-03-28T09:10:00.000Z',
        updatedAt: '2026-03-28T09:24:00.000Z',
        lat: 50.4501,
        lng: 30.5234,
        locationLabel: 'North grid sector',
        zoneId: 'zone-north',
        sourceCount: 4,
        sources: ['OSINT channel', 'satellite cue', 'sensor fusion'],
        summary:
            'Clustered reports suggest repeated low-altitude drone activity around critical power routing.',
        status: 'watching'
    },
    {
        id: 'evt-002',
        title: 'Artillery impact pattern flagged west of river',
        type: 'artillery',
        confidence: 0.68,
        occurredAt: '2026-03-28T08:30:00.000Z',
        updatedAt: '2026-03-28T08:49:00.000Z',
        lat: 49.8397,
        lng: 24.0297,
        locationLabel: 'West bank line',
        zoneId: 'zone-west',
        sourceCount: 3,
        sources: ['thermal monitor', 'field relay'],
        summary:
            'Impact spacing appears consistent with intermittent artillery rather than a single isolated strike.',
        status: 'active'
    },
    {
        id: 'evt-003',
        title: 'Ground movement checkpoint alert',
        type: 'ground',
        confidence: 0.57,
        occurredAt: '2026-03-28T07:55:00.000Z',
        updatedAt: '2026-03-28T08:01:00.000Z',
        lat: 48.3794,
        lng: 31.1656,
        locationLabel: 'Central transport axis',
        zoneId: 'zone-central',
        sourceCount: 2,
        sources: ['traffic anomaly feed'],
        summary:
            'Ground traffic anomaly rose above baseline and remains under review for confirmation.',
        status: 'review'
    },
    {
        id: 'evt-004',
        title: 'Coastal launch signature detected',
        type: 'naval',
        confidence: 0.74,
        occurredAt: '2026-03-28T06:42:00.000Z',
        updatedAt: '2026-03-28T07:02:00.000Z',
        lat: 46.4825,
        lng: 30.7233,
        locationLabel: 'Southern coast',
        zoneId: 'zone-south',
        sourceCount: 5,
        sources: ['coastal radar', 'open media', 'audio intercept'],
        summary:
            'Maritime-origin signal cluster indicates a launch window near the southern coast.',
        status: 'escalated'
    },
    {
        id: 'evt-005',
        title: 'Airstrike alert near logistics hub',
        type: 'airstrike',
        confidence: 0.9,
        occurredAt: '2026-03-28T05:15:00.000Z',
        updatedAt: '2026-03-28T05:26:00.000Z',
        lat: 47.8388,
        lng: 35.1396,
        locationLabel: 'Southeast logistics hub',
        zoneId: 'zone-east',
        sourceCount: 6,
        sources: ['acoustic sensor', 'social footage', 'imagery pass'],
        summary:
            'High-confidence signal fusion indicates an airstrike event near a logistics concentration point.',
        status: 'active'
    }
]

export const mockZones: DashboardZone[] = [
    {
        id: 'zone-north',
        name: 'North corridor',
        center: { lat: 50.45, lng: 30.52 },
        eventCount: 6,
        avgConfidence: 0.76,
        severity: 'high',
        heat: 84
    },
    {
        id: 'zone-west',
        name: 'West bank',
        center: { lat: 49.84, lng: 24.03 },
        eventCount: 3,
        avgConfidence: 0.66,
        severity: 'medium',
        heat: 58
    },
    {
        id: 'zone-central',
        name: 'Central axis',
        center: { lat: 48.38, lng: 31.17 },
        eventCount: 2,
        avgConfidence: 0.57,
        severity: 'medium',
        heat: 43
    },
    {
        id: 'zone-east',
        name: 'East logistics belt',
        center: { lat: 47.84, lng: 35.14 },
        eventCount: 5,
        avgConfidence: 0.81,
        severity: 'high',
        heat: 91
    },
    {
        id: 'zone-south',
        name: 'Southern coast',
        center: { lat: 46.48, lng: 30.72 },
        eventCount: 4,
        avgConfidence: 0.72,
        severity: 'medium',
        heat: 64
    }
]

export const mockTimeline: DashboardTimelineBucket[] = [
    {
        bucketStart: '2026-03-28T04:00:00.000Z',
        total: 2,
        airstrike: 1,
        drone: 1
    },
    {
        bucketStart: '2026-03-28T05:00:00.000Z',
        total: 4,
        airstrike: 2,
        artillery: 1,
        drone: 1
    },
    {
        bucketStart: '2026-03-28T06:00:00.000Z',
        total: 3,
        naval: 1,
        drone: 1,
        ground: 1
    },
    {
        bucketStart: '2026-03-28T07:00:00.000Z',
        total: 2,
        artillery: 1,
        ground: 1
    },
    {
        bucketStart: '2026-03-28T08:00:00.000Z',
        total: 3,
        artillery: 2,
        drone: 1
    },
    {
        bucketStart: '2026-03-28T09:00:00.000Z',
        total: 5,
        airstrike: 1,
        drone: 3,
        naval: 1
    }
]

export const resolveDashboardApiBaseUrl = (): string => {
    const env = ((import.meta as ImportMeta & {
        env?: Record<string, string | undefined>
    }).env || {}) as Record<string, string | undefined>

    const baseUrl =
        env.NEXT_PUBLIC_API_BASE_URL ||
        env.VITE_API_URL ||
        DEFAULT_API_BASE_URL

    return baseUrl.replace(/\/$/, '')
}

const fetchJson = async <T>(url: string): Promise<T> => {
    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`)
    }

    const json = (await response.json()) as T | Envelope<T>

    if (
        json &&
        typeof json === 'object' &&
        'success' in json &&
        Object.prototype.hasOwnProperty.call(json, 'data')
    ) {
        return (json as Envelope<T>).data as T
    }

    return json as T
}

const safeFetch = async <T>(
    url: string,
    fallback: T,
    errors: string[]
): Promise<T> => {
    try {
        return await fetchJson<T>(url)
    } catch (error) {
        errors.push(
            error instanceof Error ? `${url}: ${error.message}` : `${url}: failed`
        )
        return fallback
    }
}

export const loadDashboardData = async (): Promise<DashboardPayload> => {
    const apiBaseUrl = resolveDashboardApiBaseUrl()
    const errors: string[] = []

    const [events, zones, timeline] = await Promise.all([
        safeFetch<DashboardEvent[]>(`${apiBaseUrl}/events`, mockEvents, errors),
        safeFetch<DashboardZone[]>(`${apiBaseUrl}/zones`, mockZones, errors),
        safeFetch<DashboardTimelineBucket[]>(
            `${apiBaseUrl}/timeline`,
            mockTimeline,
            errors
        )
    ])

    return {
        events,
        zones,
        timeline,
        usingMockData: errors.length > 0,
        apiBaseUrl,
        errors
    }
}

export const eventTypeLabel = (type: DashboardEventType): string => {
    switch (type) {
        case 'airstrike':
            return 'Airstrike'
        case 'artillery':
            return 'Artillery'
        case 'drone':
            return 'Drone'
        case 'naval':
            return 'Naval'
        case 'ground':
            return 'Ground'
        default:
            return type
    }
}