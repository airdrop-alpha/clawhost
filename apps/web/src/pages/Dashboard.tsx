import type { FC, ReactNode } from 'react'
import type {
    DashboardEvent,
    DashboardEventType,
    DashboardTimelineBucket,
    DashboardZone
} from '@/lib/dashboard'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Broadcast,
    ChartBar,
    Crosshair,
    GlobeHemisphereWest,
    Pulse,
    ShieldWarning,
    WarningDiamond
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { Header } from '@/components/Header'
import { LandingFooter } from '@/components/LandingFooter'
import { PageBackground } from '@/components/PageBackground'
import { PageTitle } from '@/components/PageTitle'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    eventTypeLabel,
    loadDashboardData,
    resolveDashboardApiBaseUrl,
    type DashboardPayload
} from '@/lib/dashboard'

const EVENT_TYPE_OPTIONS: Array<'all' | DashboardEventType> = [
    'all',
    'airstrike',
    'artillery',
    'drone',
    'naval',
    'ground'
]

const WINDOW_OPTIONS = [
    { label: '6h', value: '6h', count: 6 },
    { label: '12h', value: '12h', count: 12 },
    { label: '24h', value: '24h', count: 24 }
] as const

const Dashboard: FC = (): ReactNode => {
    const [payload, setPayload] = useState<DashboardPayload | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [confidenceMin, setConfidenceMin] = useState(55)
    const [windowValue, setWindowValue] = useState<(typeof WINDOW_OPTIONS)[number]['value']>('12h')
    const [eventType, setEventType] = useState<'all' | DashboardEventType>('all')
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        void (async () => {
            setIsLoading(true)
            const nextPayload = await loadDashboardData()

            if (!active) return

            setPayload(nextPayload)
            setSelectedEventId((current) => current ?? nextPayload.events[0]?.id ?? null)
            setIsLoading(false)
        })()

        return () => {
            active = false
        }
    }, [])

    const filteredEvents = useMemo(() => {
        if (!payload) return []

        return payload.events.filter((event) => {
            if (event.confidence * 100 < confidenceMin) return false
            if (eventType !== 'all' && event.type !== eventType) return false
            return true
        })
    }, [payload, confidenceMin, eventType])

    const selectedEvent =
        filteredEvents.find((event) => event.id === selectedEventId) ||
        filteredEvents[0] ||
        payload?.events[0] ||
        null

    useEffect(() => {
        if (selectedEvent && selectedEvent.id !== selectedEventId) {
            setSelectedEventId(selectedEvent.id)
        }
    }, [selectedEvent, selectedEventId])

    const selectedZone = useMemo(() => {
        if (!payload || !selectedEvent?.zoneId) return null
        return payload.zones.find((zone) => zone.id === selectedEvent.zoneId) || null
    }, [payload, selectedEvent])

    const visibleTimeline = useMemo(() => {
        if (!payload) return []
        const bucketCount = WINDOW_OPTIONS.find(
            (option) => option.value === windowValue
        )?.count
        const sliced = payload.timeline.slice(-(bucketCount ?? payload.timeline.length))

        return sliced.map((bucket) => ({
            ...bucket,
            total:
                eventType === 'all'
                    ? bucket.total
                    : (bucket[eventType] ?? 0)
        }))
    }, [payload, windowValue, eventType])

    const zoneSummary = useMemo(() => {
        if (!payload) {
            return {
                hottestZone: null as DashboardZone | null,
                totalSources: 0,
                avgConfidence: 0
            }
        }

        const hottestZone = [...payload.zones].sort((a, b) => b.heat - a.heat)[0] || null
        const totalSources = filteredEvents.reduce(
            (sum, event) => sum + event.sourceCount,
            0
        )
        const avgConfidence =
            filteredEvents.length > 0
                ? filteredEvents.reduce((sum, event) => sum + event.confidence, 0) /
                  filteredEvents.length
                : 0

        return { hottestZone, totalSources, avgConfidence }
    }, [payload, filteredEvents])

    return (
        <div className='relative flex min-h-screen flex-col bg-[#050816] text-white'>
            <PageTitle
                title='Analysis Dashboard'
                description='Situational dashboard with event feed, map, and timeline.'
            />
            <PageBackground />
            <Header />

            <motion.main
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className='relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8'
            >
                <section className='rounded-3xl border border-cyan-400/15 bg-slate-950/70 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-sm sm:p-6'>
                    <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Badge className='border-cyan-400/30 bg-cyan-400/10 text-cyan-200'>
                                    DEMO / mock-safe UI
                                </Badge>
                                <Badge className='border-amber-400/30 bg-amber-500/10 text-amber-200'>
                                    Analysis, not official confirmation
                                </Badge>
                                {payload?.usingMockData ? (
                                    <Badge className='border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200'>
                                        Fallback data active
                                    </Badge>
                                ) : (
                                    <Badge className='border-emerald-400/30 bg-emerald-500/10 text-emerald-200'>
                                        API live
                                    </Badge>
                                )}
                            </div>
                            <div>
                                <p className='text-xs uppercase tracking-[0.28em] text-slate-400'>
                                    Dashboard v1
                                </p>
                                <h1 className='mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl'>
                                    Event feed, map panel, and timeline in one view
                                </h1>
                                <p className='mt-3 max-w-3xl text-sm text-slate-300 sm:text-base'>
                                    Pulls <code className='rounded bg-white/5 px-1 py-0.5 text-slate-100'>{resolveDashboardApiBaseUrl()}</code>
                                    {' '}for <code className='rounded bg-white/5 px-1 py-0.5 text-slate-100'>/events</code>,{' '}
                                    <code className='rounded bg-white/5 px-1 py-0.5 text-slate-100'>/zones</code>, and{' '}
                                    <code className='rounded bg-white/5 px-1 py-0.5 text-slate-100'>/timeline</code>.
                                    If any endpoint is unavailable, the UI stays usable with local fallback data.
                                </p>
                            </div>
                        </div>

                        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                            <StatCard label='Events shown' value={String(filteredEvents.length)} icon={<Pulse size={18} />} />
                            <StatCard label='Avg confidence' value={`${Math.round(zoneSummary.avgConfidence * 100)}%`} icon={<ShieldWarning size={18} />} />
                            <StatCard label='Zones' value={String(payload?.zones.length ?? 0)} icon={<GlobeHemisphereWest size={18} />} />
                            <StatCard label='Sources counted' value={String(zoneSummary.totalSources)} icon={<Broadcast size={18} />} />
                        </div>
                    </div>

                    {payload?.errors.length ? (
                        <div className='mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100'>
                            <div className='flex items-center gap-2 font-medium'>
                                <WarningDiamond size={16} />
                                Endpoint fallback triggered
                            </div>
                            <ul className='mt-2 list-disc space-y-1 pl-5 text-amber-50/90'>
                                {payload.errors.map((error) => (
                                    <li key={error}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </section>

                <section className='grid gap-4 xl:grid-cols-[1.08fr_1.35fr_1.08fr]'>
                    <Card className='border-white/10 bg-slate-950/65'>
                        <CardHeader className='pb-4'>
                            <div className='flex items-center justify-between gap-3'>
                                <div>
                                    <CardTitle className='text-lg text-white'>Event feed</CardTitle>
                                    <p className='mt-1 text-sm text-slate-400'>Confidence, timing, and source density.</p>
                                </div>
                                <Badge className='border-white/10 bg-white/5 text-slate-300'>
                                    {isLoading ? 'Loading' : `${filteredEvents.length} visible`}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className='space-y-3'>
                            {isLoading ? (
                                <FeedSkeleton />
                            ) : filteredEvents.length === 0 ? (
                                <EmptyPanel label='No events match the current filters.' />
                            ) : (
                                <div className='space-y-3'>
                                    {filteredEvents.map((event) => (
                                        <button
                                            type='button'
                                            key={event.id}
                                            onClick={() => setSelectedEventId(event.id)}
                                            className={`w-full rounded-2xl border p-4 text-left transition ${
                                                selectedEvent?.id === event.id
                                                    ? 'border-cyan-400/40 bg-cyan-400/10 shadow-lg shadow-cyan-950/30'
                                                    : 'border-white/8 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                                            }`}
                                        >
                                            <div className='flex items-start justify-between gap-3'>
                                                <div>
                                                    <div className='flex flex-wrap items-center gap-2'>
                                                        <Badge className={confidenceBadgeClass(event.confidence)}>
                                                            {Math.round(event.confidence * 100)}% confidence
                                                        </Badge>
                                                        <Badge className='border-white/10 bg-white/5 text-slate-300'>
                                                            {eventTypeLabel(event.type)}
                                                        </Badge>
                                                    </div>
                                                    <h3 className='mt-3 text-sm font-semibold text-white sm:text-base'>
                                                        {event.title}
                                                    </h3>
                                                </div>
                                                <Crosshair className='mt-1 shrink-0 text-slate-500' size={18} />
                                            </div>
                                            <div className='mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400'>
                                                <span>{formatRelativeTime(event.occurredAt)}</span>
                                                <span>{event.sourceCount} sources</span>
                                                <span>{event.locationLabel}</span>
                                                <span>{event.status || 'monitoring'}</span>
                                            </div>
                                            <p className='mt-3 line-clamp-2 text-sm text-slate-300'>
                                                {event.summary}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className='space-y-4'>
                        <Card className='border-white/10 bg-slate-950/65'>
                            <CardHeader className='pb-4'>
                                <div className='flex items-center justify-between gap-3'>
                                    <div>
                                        <CardTitle className='text-lg text-white'>Map panel</CardTitle>
                                        <p className='mt-1 text-sm text-slate-400'>Mapbox when token exists, SVG fallback otherwise.</p>
                                    </div>
                                    <Badge className='border-white/10 bg-white/5 text-slate-300'>
                                        {import.meta.env.NEXT_PUBLIC_MAPBOX_TOKEN ? 'Mapbox' : 'Fallback map'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <DashboardMap
                                    events={filteredEvents}
                                    zones={payload?.zones ?? []}
                                    selectedEventId={selectedEvent?.id ?? null}
                                    onSelectEvent={setSelectedEventId}
                                />
                            </CardContent>
                        </Card>

                        <div className='grid gap-4 md:grid-cols-2'>
                            <Card className='border-white/10 bg-slate-950/65'>
                                <CardHeader className='pb-3'>
                                    <CardTitle className='text-base text-white'>Heat / zone summary</CardTitle>
                                </CardHeader>
                                <CardContent className='space-y-3'>
                                    <SummaryRow
                                        label='Hottest zone'
                                        value={zoneSummary.hottestZone?.name || '—'}
                                        detail={zoneSummary.hottestZone ? `${zoneSummary.hottestZone.heat} heat` : 'No data'}
                                    />
                                    <SummaryRow
                                        label='Selected zone'
                                        value={selectedZone?.name || 'Unassigned'}
                                        detail={selectedZone ? `${selectedZone.eventCount} events • ${Math.round(selectedZone.avgConfidence * 100)}% avg confidence` : 'No mapped zone'}
                                    />
                                    <SummaryRow
                                        label='Selected location'
                                        value={selectedEvent?.locationLabel || '—'}
                                        detail={selectedEvent ? `${selectedEvent.lat.toFixed(2)}, ${selectedEvent.lng.toFixed(2)}` : 'No event selected'}
                                    />
                                </CardContent>
                            </Card>

                            <Card className='border-white/10 bg-slate-950/65'>
                                <CardHeader className='pb-3'>
                                    <CardTitle className='text-base text-white'>Selected event</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {selectedEvent ? (
                                        <div className='space-y-4'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <Badge className={confidenceBadgeClass(selectedEvent.confidence)}>
                                                    {Math.round(selectedEvent.confidence * 100)}% confidence
                                                </Badge>
                                                <Badge className='border-white/10 bg-white/5 text-slate-300'>
                                                    {eventTypeLabel(selectedEvent.type)}
                                                </Badge>
                                            </div>
                                            <div>
                                                <h3 className='text-lg font-semibold text-white'>
                                                    {selectedEvent.title}
                                                </h3>
                                                <p className='mt-2 text-sm leading-6 text-slate-300'>
                                                    {selectedEvent.summary}
                                                </p>
                                            </div>
                                            <dl className='grid grid-cols-2 gap-3 text-sm'>
                                                <DetailItem label='Occurred' value={formatAbsoluteTime(selectedEvent.occurredAt)} />
                                                <DetailItem label='Sources' value={String(selectedEvent.sourceCount)} />
                                                <DetailItem label='Coordinates' value={`${selectedEvent.lat.toFixed(2)}, ${selectedEvent.lng.toFixed(2)}`} />
                                                <DetailItem label='Status' value={selectedEvent.status || 'monitoring'} />
                                            </dl>
                                        </div>
                                    ) : (
                                        <EmptyPanel label='Select an event to inspect its details.' />
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <Card className='border-white/10 bg-slate-950/65'>
                        <CardHeader className='pb-4'>
                            <div className='flex items-center justify-between gap-3'>
                                <div>
                                    <CardTitle className='text-lg text-white'>Timeline + filters</CardTitle>
                                    <p className='mt-1 text-sm text-slate-400'>Filter by time window, confidence minimum, and event type.</p>
                                </div>
                                <ChartBar className='text-slate-500' size={20} />
                            </div>
                        </CardHeader>
                        <CardContent className='space-y-5'>
                            <div className='grid gap-4'>
                                <label className='grid gap-2 text-sm text-slate-300'>
                                    <span>Window</span>
                                    <select
                                        value={windowValue}
                                        onChange={(event) => setWindowValue(event.target.value as (typeof WINDOW_OPTIONS)[number]['value'])}
                                        className='h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none transition focus:border-cyan-400/40'
                                    >
                                        {WINDOW_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value} className='bg-slate-950'>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className='grid gap-2 text-sm text-slate-300'>
                                    <span>Confidence minimum: {confidenceMin}%</span>
                                    <input
                                        type='range'
                                        min={0}
                                        max={95}
                                        step={5}
                                        value={confidenceMin}
                                        onChange={(event) => setConfidenceMin(Number(event.target.value))}
                                        className='accent-cyan-400'
                                    />
                                </label>

                                <label className='grid gap-2 text-sm text-slate-300'>
                                    <span>Event type</span>
                                    <select
                                        value={eventType}
                                        onChange={(event) => setEventType(event.target.value as 'all' | DashboardEventType)}
                                        className='h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none transition focus:border-cyan-400/40'
                                    >
                                        {EVENT_TYPE_OPTIONS.map((option) => (
                                            <option key={option} value={option} className='bg-slate-950'>
                                                {option === 'all' ? 'All types' : eventTypeLabel(option)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <TimelineChart buckets={visibleTimeline} />
                        </CardContent>
                    </Card>
                </section>
            </motion.main>

            <LandingFooter />
        </div>
    )
}

const StatCard = ({
    label,
    value,
    icon
}: {
    label: string
    value: string
    icon: ReactNode
}) => (
    <div className='rounded-2xl border border-white/10 bg-white/[0.04] p-3'>
        <div className='flex items-center justify-between gap-2 text-slate-400'>
            <span className='text-xs uppercase tracking-[0.2em]'>{label}</span>
            <span>{icon}</span>
        </div>
        <div className='mt-2 text-2xl font-semibold text-white'>{value}</div>
    </div>
)

const FeedSkeleton = () => (
    <div className='space-y-3'>
        {Array.from({ length: 4 }).map((_, index) => (
            <div
                key={index}
                className='h-32 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]'
            />
        ))}
    </div>
)

const EmptyPanel = ({ label }: { label: string }) => (
    <div className='rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400'>
        {label}
    </div>
)

const SummaryRow = ({
    label,
    value,
    detail
}: {
    label: string
    value: string
    detail: string
}) => (
    <div className='rounded-2xl border border-white/8 bg-white/[0.03] p-3'>
        <div className='text-xs uppercase tracking-[0.2em] text-slate-500'>{label}</div>
        <div className='mt-2 text-base font-medium text-white'>{value}</div>
        <div className='mt-1 text-sm text-slate-400'>{detail}</div>
    </div>
)

const DetailItem = ({ label, value }: { label: string; value: string }) => (
    <div className='rounded-2xl border border-white/8 bg-white/[0.03] p-3'>
        <dt className='text-xs uppercase tracking-[0.2em] text-slate-500'>{label}</dt>
        <dd className='mt-2 text-sm text-slate-200'>{value}</dd>
    </div>
)

const TimelineChart = ({ buckets }: { buckets: DashboardTimelineBucket[] }) => {
    const maxValue = Math.max(...buckets.map((bucket) => bucket.total), 1)

    return (
        <div className='rounded-3xl border border-white/10 bg-white/[0.03] p-4'>
            <div className='flex h-56 items-end gap-3'>
                {buckets.length === 0 ? (
                    <div className='text-sm text-slate-400'>No timeline buckets available.</div>
                ) : (
                    buckets.map((bucket) => {
                        const height = `${Math.max((bucket.total / maxValue) * 100, 8)}%`

                        return (
                            <div key={bucket.bucketStart} className='flex flex-1 flex-col items-center gap-3'>
                                <div className='flex h-full w-full items-end'>
                                    <div className='w-full rounded-t-2xl bg-gradient-to-t from-cyan-500/60 to-fuchsia-500/80' style={{ height }} />
                                </div>
                                <div className='space-y-1 text-center'>
                                    <div className='text-sm font-medium text-white'>{bucket.total}</div>
                                    <div className='text-[11px] uppercase tracking-[0.18em] text-slate-500'>
                                        {new Date(bucket.bucketStart).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}

const DashboardMap = ({
    events,
    zones,
    selectedEventId,
    onSelectEvent
}: {
    events: DashboardEvent[]
    zones: DashboardZone[]
    selectedEventId: string | null
    onSelectEvent: (eventId: string) => void
}) => {
    const mapRef = useRef<HTMLDivElement | null>(null)
    const [mapboxReady, setMapboxReady] = useState(false)

    useEffect(() => {
        const token = import.meta.env.NEXT_PUBLIC_MAPBOX_TOKEN as string | undefined
        const container = mapRef.current

        if (!token || !container) {
            setMapboxReady(false)
            return
        }

        let disposed = false
        let mapInstance: {
            remove: () => void
            addControl: (...args: unknown[]) => void
            on: (name: string, handler: () => void) => void
        } | null = null
        let markerInstances: Array<{ remove: () => void }> = []

        const boot = async () => {
            const mapboxgl = await loadMapbox()
            if (disposed || !container) return

            mapboxgl.accessToken = token
            mapInstance = new mapboxgl.Map({
                container,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [31.1656, 48.3794],
                zoom: 4.6,
                attributionControl: false
            })

            mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right')
            mapInstance.on('load', () => {
                if (!mapInstance || disposed) return
                markerInstances = events.map((event) => {
                    const el = document.createElement('button')
                    el.type = 'button'
                    el.className = `h-3.5 w-3.5 rounded-full border-2 ${
                        event.id === selectedEventId
                            ? 'border-white bg-cyan-300 shadow-[0_0_0_6px_rgba(34,211,238,0.18)]'
                            : 'border-slate-950 bg-fuchsia-400'
                    }`
                    el.title = event.title
                    el.addEventListener('click', () => onSelectEvent(event.id))
                    return new mapboxgl.Marker(el)
                        .setLngLat([event.lng, event.lat])
                        .addTo(mapInstance as never)
                })
                setMapboxReady(true)
            })
        }

        void boot().catch(() => {
            setMapboxReady(false)
        })

        return () => {
            disposed = true
            markerInstances.forEach((marker) => marker.remove())
            mapInstance?.remove()
        }
    }, [events, selectedEventId, onSelectEvent])

    return (
        <div className='space-y-3'>
            {import.meta.env.NEXT_PUBLIC_MAPBOX_TOKEN ? (
                <div
                    ref={mapRef}
                    className='h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-slate-900'
                />
            ) : null}

            {!mapboxReady ? (
                <FallbackMap
                    events={events}
                    zones={zones}
                    selectedEventId={selectedEventId}
                    onSelectEvent={onSelectEvent}
                />
            ) : null}
        </div>
    )
}

const FallbackMap = ({
    events,
    zones,
    selectedEventId,
    onSelectEvent
}: {
    events: DashboardEvent[]
    zones: DashboardZone[]
    selectedEventId: string | null
    onSelectEvent: (eventId: string) => void
}) => {
    const dimensions = {
        width: 720,
        height: 340,
        padding: 24
    }

    const latitudes = events.map((event) => event.lat)
    const longitudes = events.map((event) => event.lng)
    const minLat = Math.min(...latitudes, 44)
    const maxLat = Math.max(...latitudes, 52)
    const minLng = Math.min(...longitudes, 22)
    const maxLng = Math.max(...longitudes, 38)

    return (
        <div className='space-y-3'>
            <div className='relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.95))]'>
                <svg viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} className='h-[340px] w-full'>
                    <defs>
                        <pattern id='grid' width='48' height='48' patternUnits='userSpaceOnUse'>
                            <path d='M 48 0 L 0 0 0 48' fill='none' stroke='rgba(148,163,184,0.12)' strokeWidth='1' />
                        </pattern>
                    </defs>
                    <rect width={dimensions.width} height={dimensions.height} fill='url(#grid)' />
                    {zones.map((zone) => {
                        const point = projectPoint(
                            zone.center.lat,
                            zone.center.lng,
                            minLat,
                            maxLat,
                            minLng,
                            maxLng,
                            dimensions
                        )
                        return (
                            <g key={zone.id}>
                                <circle cx={point.x} cy={point.y} r={16 + zone.heat * 0.22} fill='rgba(244,114,182,0.08)' stroke='rgba(244,114,182,0.24)' />
                                <text x={point.x + 12} y={point.y - 12} fill='rgba(226,232,240,0.7)' fontSize='12'>
                                    {zone.name}
                                </text>
                            </g>
                        )
                    })}
                    {events.map((event) => {
                        const point = projectPoint(
                            event.lat,
                            event.lng,
                            minLat,
                            maxLat,
                            minLng,
                            maxLng,
                            dimensions
                        )
                        const selected = selectedEventId === event.id
                        return (
                            <g key={event.id} onClick={() => onSelectEvent(event.id)} className='cursor-pointer'>
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={selected ? 11 : 8}
                                    fill={selected ? 'rgba(34,211,238,0.95)' : 'rgba(244,114,182,0.95)'}
                                    stroke='white'
                                    strokeWidth='2'
                                />
                            </g>
                        )
                    })}
                </svg>
            </div>
            <div className='rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300'>
                No Mapbox token detected. Rendering the lightweight fallback geospatial view so the dashboard still works.
            </div>
        </div>
    )
}

const projectPoint = (
    lat: number,
    lng: number,
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
    dimensions: { width: number; height: number; padding: number }
) => {
    const x =
        dimensions.padding +
        ((lng - minLng) / Math.max(maxLng - minLng, 1)) * (dimensions.width - dimensions.padding * 2)
    const y =
        dimensions.height -
        dimensions.padding -
        ((lat - minLat) / Math.max(maxLat - minLat, 1)) * (dimensions.height - dimensions.padding * 2)

    return { x, y }
}

let mapboxLoader: Promise<MapboxModule> | null = null

type MapboxModule = {
    accessToken: string
    Map: new (options: Record<string, unknown>) => {
        addControl: (...args: unknown[]) => void
        on: (name: string, handler: () => void) => void
        remove: () => void
    }
    Marker: new (element?: HTMLElement) => {
        setLngLat: (coords: [number, number]) => { addTo: (map: unknown) => { remove: () => void } }
    }
    NavigationControl: new () => unknown
}

const loadMapbox = async (): Promise<MapboxModule> => {
    if (mapboxLoader) return mapboxLoader

    mapboxLoader = new Promise((resolve, reject) => {
        const windowWithMapbox = window as unknown as Window & {
            mapboxgl?: MapboxModule
        }

        if (windowWithMapbox.mapboxgl) {
            resolve(windowWithMapbox.mapboxgl)
            return
        }

        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css'
        document.head.appendChild(link)

        const script = document.createElement('script')
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js'
        script.async = true
        script.onload = () => {
            const mapboxgl = (window as Window & { mapboxgl?: MapboxModule }).mapboxgl
            if (mapboxgl) resolve(mapboxgl)
            else reject(new Error('Mapbox failed to load'))
        }
        script.onerror = () => reject(new Error('Mapbox script failed'))
        document.head.appendChild(script)
    })

    return mapboxLoader
}

const confidenceBadgeClass = (confidence: number): string => {
    if (confidence >= 0.8) {
        return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
    }
    if (confidence >= 0.65) {
        return 'border-amber-400/30 bg-amber-500/10 text-amber-200'
    }
    return 'border-rose-400/30 bg-rose-500/10 text-rose-200'
}

const formatRelativeTime = (timestamp: string): string => {
    const delta = Date.now() - new Date(timestamp).getTime()
    const hours = Math.max(Math.round(delta / (1000 * 60 * 60)), 0)

    if (hours < 1) return 'Less than 1h ago'
    if (hours === 1) return '1h ago'
    return `${hours}h ago`
}

const formatAbsoluteTime = (timestamp: string): string =>
    new Date(timestamp).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })

export default Dashboard