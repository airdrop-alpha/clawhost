import type {
    CloudProvider,
    ServerStatus,
    CreateServerResult,
    ServerTypeInfo,
    LocationInfo,
    CreateSSHKeyResult,
    VolumeInfo,
    VolumeDetails,
    VolumePricingResult,
    RawServerType,
    DatacenterAvailability
} from '@/ts/Interfaces'

import { RequestClient } from '@openclaw/shared'

/**
 * BitLaunch API Provider
 *
 * BitLaunch is a meta-provider that provisions servers on DigitalOcean, Vultr, or Linode
 * via their unified API. Base URL: https://app.bitlaunch.io/api
 *
 * Host IDs:
 *   1 = DigitalOcean
 *   3 = Vultr
 *   4 = Linode
 *
 * API endpoints (from Go client):
 *   POST   /servers                        - Create server
 *   GET    /servers                         - List servers
 *   GET    /servers/:id                     - Show server
 *   DELETE /servers/:id                     - Destroy server
 *   POST   /servers/:id/restart             - Restart server
 *   POST   /servers/:id/rebuild             - Rebuild server
 *   POST   /servers/:id/resize              - Resize server
 *   GET    /hosts-create-options/:hostID    - Get images/regions/sizes for a host
 *   POST   /ssh-keys                        - Create SSH key
 *   GET    /ssh-keys                        - List SSH keys
 *   DELETE /ssh-keys/:id                    - Delete SSH key
 *
 * Note: BitLaunch API does NOT have native start/stop endpoints.
 *       We use restart as a workaround. Stop is a no-op (server billing continues).
 */

// Default host: Vultr (hostID=3) — good balance of price/features
const DEFAULT_HOST_ID = 3

// BitLaunch API response types
interface BitLaunchServer {
    id: string
    name: string
    host: number
    ipv4: string
    region: string
    size: string
    sizeDescription: string
    image: string
    imageDescription: string
    created: string
    rate: number
    bandwidthUsed: number
    bandwidthAllowance: number
    status: string
    errorText: string
    backupsEnabled: boolean
    diskGB: number
}

interface BitLaunchHostImageVersion {
    id: string
    description: string
    passwordUnsupported: boolean
}

interface BitLaunchHostImage {
    id: number
    name: string
    type: string
    minDiskSize: number
    unavailableRegions: string[]
    version: BitLaunchHostImageVersion
    versions: BitLaunchHostImageVersion[]
    extraCostPerMonth: number
    windows: boolean
}

interface BitLaunchHostSubRegion {
    id: string
    description: string
    slug: string
    unavailableSizes: string[]
}

interface BitLaunchHostRegion {
    id: number
    name: string
    iso: string
    subregion: BitLaunchHostSubRegion
    subregions: BitLaunchHostSubRegion[]
}

interface BitLaunchHostSize {
    id: string
    slug: string
    bandwidthGB: number
    cpuCount: number
    diskGB: number
    memoryMB: number
    costPerHr: number
    costPerMonth: number
    planType: string
}

interface BitLaunchCreateOptions {
    hostID: number
    image: BitLaunchHostImage[]
    region: BitLaunchHostRegion[]
    size: BitLaunchHostSize[]
    available: boolean
    bandwidthCost: number
    planTypes: Array<{ type: string; description: string; name: string }>
}

interface BitLaunchSSHKey {
    id: string
    name: string
    fingerprint: string
    content: string
    created: string
}

// Cache for create options (expensive call)
let createOptionsCache: { data: BitLaunchCreateOptions; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getClient() {
    const token = process.env.BITLAUNCH_API_TOKEN
    if (!token) {
        throw new Error('BITLAUNCH_API_TOKEN is not set')
    }

    return new RequestClient({
        baseUrl: 'https://app.bitlaunch.io/api',
        getHeaders: () => ({ 'Authorization': `Bearer: ${token}` })
    })
}

async function getCreateOptions(hostId: number = DEFAULT_HOST_ID): Promise<BitLaunchCreateOptions> {
    const now = Date.now()
    if (createOptionsCache && (now - createOptionsCache.timestamp) < CACHE_TTL) {
        return createOptionsCache.data
    }

    const data = await getClient().get<BitLaunchCreateOptions>(
        `/hosts-create-options/${hostId}`
    )
    createOptionsCache = { data, timestamp: now }
    return data
}

/**
 * Find the Ubuntu 24.04 image from BitLaunch's image catalog
 */
function findUbuntuImage(images: BitLaunchHostImage[]): BitLaunchHostImageVersion | null {
    // Look for Ubuntu image
    const ubuntu = images.find(
        (img) => img.name.toLowerCase().includes('ubuntu') && img.type === 'os'
    )
    if (!ubuntu) return null

    // Prefer 24.04, then latest version
    const v2404 = ubuntu.versions.find((v) => v.description.includes('24.04'))
    if (v2404) return v2404

    const v2204 = ubuntu.versions.find((v) => v.description.includes('22.04'))
    if (v2204) return v2204

    return ubuntu.version // default version
}

export const bitlaunch: CloudProvider = {
    async createServer(
        name: string,
        serverType: string,
        location: string,
        rootPassword?: string,
        sshKeyIds?: number[],
        _snapshotId?: string,
        userData?: string
    ): Promise<CreateServerResult> {
        const options = await getCreateOptions()

        // Find Ubuntu image
        const ubuntuVersion = findUbuntuImage(options.image)
        if (!ubuntuVersion) {
            throw new Error('Could not find Ubuntu image on BitLaunch')
        }

        const body: Record<string, unknown> = {
            server: {
                name,
                hostID: DEFAULT_HOST_ID,
                HostImageID: ubuntuVersion.id,
                sizeID: serverType,
                regionID: location,
                password: rootPassword || '',
                sshKeys: sshKeyIds?.map(String) || [],
                initscript: userData || ''
            }
        }

        const data = await getClient().post<BitLaunchServer>('/servers', body)

        return {
            serverId: Number(data.id) || 0,
            ip: data.ipv4 || '',
            rootPassword: rootPassword || ''
        }
    },

    async getServer(serverId: string): Promise<ServerStatus> {
        const data = await getClient().get<{ Server: BitLaunchServer }>(
            `/servers/${serverId}`
        )
        const server = data.Server
        return {
            status: mapStatus(server.status),
            ip: server.ipv4 || ''
        }
    },

    async getServers(): Promise<Map<string, ServerStatus>> {
        const servers = await getClient().get<BitLaunchServer[]>('/servers')
        const result = new Map<string, ServerStatus>()
        for (const server of servers) {
            result.set(server.id, {
                status: mapStatus(server.status),
                ip: server.ipv4 || ''
            })
        }
        return result
    },

    async startServer(serverId: string): Promise<void> {
        // BitLaunch has no dedicated start endpoint; restart is the closest action
        await getClient().post(`/servers/${serverId}/restart`)
    },

    async stopServer(_serverId: string): Promise<void> {
        // BitLaunch API does not support stop. Servers remain running.
        // To truly stop, you'd need to destroy and recreate.
        throw new Error(
            'BitLaunch does not support stopping servers. Use deleteServer instead.'
        )
    },

    async restartServer(serverId: string): Promise<void> {
        await getClient().post(`/servers/${serverId}/restart`)
    },

    async deleteServer(serverId: string): Promise<void> {
        await getClient().delete(`/servers/${serverId}`)
    },

    async getServerTypes(): Promise<ServerTypeInfo[]> {
        const options = await getCreateOptions()

        return options.size.map((s) => ({
            name: s.id,
            description: `${s.slug} - ${s.cpuCount} vCPU, ${s.memoryMB}MB RAM, ${s.diskGB}GB SSD`,
            cores: s.cpuCount,
            memory: s.memoryMB / 1024, // Convert MB to GB to match Hetzner format
            disk: s.diskGB,
            architecture: 'x86',
            priceHourly: s.costPerHr / 10000, // BitLaunch uses cents*100
            priceMonthly: s.costPerMonth
        }))
    },

    async getLocations(): Promise<LocationInfo[]> {
        const options = await getCreateOptions()
        const locations: LocationInfo[] = []

        for (const region of options.region) {
            for (const sub of region.subregions) {
                locations.push({
                    id: sub.id,
                    name: `${region.name} - ${sub.description}`,
                    city: sub.description,
                    country: region.iso,
                    disabled: false
                })
            }
            // If no subregions, use the default
            if (region.subregions.length === 0) {
                locations.push({
                    id: region.subregion.id,
                    name: `${region.name} - ${region.subregion.description}`,
                    city: region.subregion.description,
                    country: region.iso,
                    disabled: false
                })
            }
        }

        return locations
    },

    async getRawServerTypes(): Promise<RawServerType[]> {
        const options = await getCreateOptions()
        return options.size.map((s, idx) => ({
            id: idx + 1,
            name: s.id
        }))
    },

    async getDatacenters(): Promise<DatacenterAvailability[]> {
        const options = await getCreateOptions()
        const allSizeIds = options.size.map((_, idx) => idx + 1)

        return options.region.flatMap((region) => {
            if (region.subregions.length === 0) {
                return [{
                    name: region.subregion.id,
                    locationName: region.subregion.id,
                    availableServerTypeIds: allSizeIds.filter((_, sIdx) => {
                        const size = options.size[sIdx]
                        return !region.subregion.unavailableSizes?.includes(size.id)
                    })
                }]
            }
            return region.subregions.map((sub) => ({
                name: sub.id,
                locationName: sub.id,
                availableServerTypeIds: allSizeIds.filter((_, sIdx) => {
                    const size = options.size[sIdx]
                    return !sub.unavailableSizes?.includes(size.id)
                })
            }))
        })
    },

    async createSSHKey(
        name: string,
        publicKey: string
    ): Promise<CreateSSHKeyResult> {
        const data = await getClient().post<BitLaunchSSHKey>('/ssh-keys', {
            name,
            content: publicKey
        })

        return {
            id: Number(data.id) || 0,
            name: data.name,
            fingerprint: data.fingerprint
        }
    },

    async deleteSSHKey(keyId: number): Promise<void> {
        await getClient().delete(`/ssh-keys/${keyId}`)
    },

    // BitLaunch doesn't have volume management — throw not supported
    async getVolumePricing(): Promise<VolumePricingResult> {
        throw new Error('BitLaunch does not support volume management')
    },

    async createVolume(
        _name: string,
        _size: number,
        _location: string,
        _serverId?: number
    ): Promise<VolumeInfo> {
        throw new Error('BitLaunch does not support volume management')
    },

    async attachVolume(_volumeId: number, _serverId: number): Promise<void> {
        throw new Error('BitLaunch does not support volume management')
    },

    async detachVolume(_volumeId: number): Promise<void> {
        throw new Error('BitLaunch does not support volume management')
    },

    async deleteVolume(_volumeId: number): Promise<void> {
        throw new Error('BitLaunch does not support volume management')
    },

    async getVolume(_volumeId: number): Promise<VolumeDetails> {
        throw new Error('BitLaunch does not support volume management')
    }
}

/**
 * Map BitLaunch status strings to our normalized format
 */
function mapStatus(status: string): string {
    switch (status.toLowerCase()) {
        case 'active':
        case 'running':
            return 'running'
        case 'provisioning':
        case 'installing':
            return 'initializing'
        case 'off':
        case 'stopped':
            return 'off'
        case 'error':
            return 'error'
        default:
            return status
    }
}