import type { Context } from 'hono'
import type { ProviderType } from '@/ts/Types'

import { getProvider } from '@/services/provider'
import { ok, fail } from '@/lib/response'
import { t } from '@openclaw/i18n'

const hetznerPlanOrder = [
    'cx23',
    'cx33',
    'cx43',
    'cx53',
    'cpx11',
    'cpx21',
    'cpx31',
    'cpx41',
    'cpx51',
    'cax11',
    'cax21',
    'cax31',
    'cax41',
    'ccx13',
    'ccx23',
    'ccx33',
    'ccx43',
    'ccx53',
    'ccx63'
]

const digitaloceanPlanOrder = [
    's-1vcpu-512mb-10gb',
    's-1vcpu-1gb',
    's-1vcpu-2gb',
    's-2vcpu-2gb',
    's-2vcpu-4gb',
    's-4vcpu-8gb',
    's-8vcpu-16gb'
]

const vultrPlanOrder = [
    'vc2-1c-1gb',
    'vc2-1c-2gb',
    'vc2-2c-2gb',
    'vc2-2c-4gb',
    'vc2-4c-8gb',
    'vc2-6c-16gb',
    'vc2-8c-32gb',
    'vc2-16c-64gb',
    'vhp-1c-1gb-amd',
    'vhp-1c-2gb-amd',
    'vhp-2c-2gb-amd',
    'vhp-2c-4gb-amd',
    'vhp-4c-8gb-amd',
    'vhp-4c-12gb-amd',
    'vhp-8c-16gb-amd',
    'vhp-12c-24gb-amd',
    'vhf-1c-2gb',
    'vhf-2c-4gb',
    'vhf-3c-8gb',
    'vhf-4c-16gb',
    'vhf-8c-32gb',
    'vhf-12c-48gb'
]

const hetznerCustomPrices: Record<string, number> = {
    cx23: 10,
    cx33: 15,
    cx43: 20,
    cx53: 30,
    cpx11: 15,
    cpx21: 20,
    cpx31: 30,
    cpx41: 50,
    cpx51: 75,
    cax11: 10,
    cax21: 15,
    cax31: 25,
    cax41: 50,
    ccx13: 25,
    ccx23: 50,
    ccx33: 100,
    ccx43: 150,
    ccx53: 250,
    ccx63: 350
}

const digitaloceanCustomPrices: Record<string, number> = {
    's-1vcpu-512mb-10gb': 10,
    's-1vcpu-1gb': 15,
    's-1vcpu-2gb': 20,
    's-2vcpu-2gb': 30,
    's-2vcpu-4gb': 50,
    's-4vcpu-8gb': 75,
    's-8vcpu-16gb': 150
}

const vultrCustomPrices: Record<string, number> = {
    'vc2-1c-1gb': 10,
    'vc2-1c-2gb': 20,
    'vc2-2c-2gb': 30,
    'vc2-2c-4gb': 40,
    'vc2-4c-8gb': 80,
    'vc2-6c-16gb': 160,
    'vc2-8c-32gb': 320,
    'vc2-16c-64gb': 500,
    'vhp-1c-1gb-amd': 12,
    'vhp-1c-2gb-amd': 24,
    'vhp-2c-2gb-amd': 32,
    'vhp-2c-4gb-amd': 48,
    'vhp-4c-8gb-amd': 120,
    'vhp-4c-12gb-amd': 180,
    'vhp-8c-16gb-amd': 192,
    'vhp-12c-24gb-amd': 250,
    'vhf-1c-2gb': 24,
    'vhf-2c-4gb': 48,
    'vhf-3c-8gb': 96,
    'vhf-4c-16gb': 125,
    'vhf-8c-32gb': 192,
    'vhf-12c-48gb': 500
}

const MIN_MEMORY_GB = 4

const providerLimits: Partial<Record<ProviderType, number>> = {
    hetzner: 10
}

const planConfigs: Record<
    ProviderType,
    { order: string[]; prices: Record<string, number> }
> = {
    hetzner: { order: hetznerPlanOrder, prices: hetznerCustomPrices },
    digitalocean: {
        order: digitaloceanPlanOrder,
        prices: digitaloceanCustomPrices
    },
    vultr: { order: vultrPlanOrder, prices: vultrCustomPrices },
    bitlaunch: { order: [], prices: {} }
}

const getPlans = async (c: Context) => {
    try {
        const providerName = (c.req.query('provider') ||
            'hetzner') as ProviderType
        const config = planConfigs[providerName]

        if (!config) {
            return fail(c, t('api.invalidProvider'), 400)
        }

        const provider = getProvider(providerName)
        const limit = providerLimits[providerName]

        const [serverTypes, servers] = await Promise.all([
            provider.getServerTypes(),
            limit ? provider.getServers() : Promise.resolve(null)
        ])

        const atCapacity = servers && limit ? servers.size >= limit : false

        const plans = serverTypes
            .filter(
                (st) =>
                    config.prices[st.name] !== undefined &&
                    st.memory >= MIN_MEMORY_GB
            )
            .map((st) => ({
                id: st.name,
                name: st.description,
                cpu: st.cores,
                memory: st.memory,
                disk: st.disk,
                priceMonthly: config.prices[st.name],
                architecture: st.architecture,
                disabled: atCapacity
            }))
            .sort(
                (a, b) =>
                    config.order.indexOf(a.id) - config.order.indexOf(b.id)
            )

        return ok(c, { plans, atCapacity }, t('api.plansFetched'))
    } catch (err) {
        console.error('Failed to fetch plans:', err)
        return fail(c, t('api.failedToFetchPlans'), 500)
    }
}

export default getPlans