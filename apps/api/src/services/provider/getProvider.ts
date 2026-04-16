import type { CloudProvider } from '@/ts/Interfaces'
import type { ProviderType } from '@/ts/Types'

import { hetzner } from '@/services/hetzner'
import { digitalocean } from '@/services/digitalocean'
import { vultr } from '@/services/vultr'
import { bitlaunch } from '@/services/bitlaunch'

const providers: Record<ProviderType, CloudProvider> = {
    hetzner,
    digitalocean,
    vultr,
    bitlaunch
}

const getProvider = (provider: ProviderType): CloudProvider => {
    const p = providers[provider]
    if (!p) {
        throw new Error(`Unknown provider: ${provider}`)
    }
    return p
}

export default getProvider