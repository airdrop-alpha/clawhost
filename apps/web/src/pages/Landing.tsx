import type { FC, ReactNode } from 'react'
import type { Faq, MockClawData, Testimonial } from '@/ts/Interfaces'
import type { ProviderType } from '@/ts/Types'

import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { t } from '@openclaw/i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageTitle } from '@/components/PageTitle'
import { Header } from '@/components/Header'
import { LandingFooter } from '@/components/LandingFooter'
import { MockClawCard } from '@/components/MockClawCard'
import { initialMockClaws } from '@/data'
import { useUIStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { ROUTES } from '@/lib/routes'
import { usePlans, useGitHubStars, GITHUB_REPO_URL } from '@/hooks'
import ProviderIcon from '@/components/ProviderIcon'
import {
    ShieldCheck,
    Globe,
    Clock,
    Terminal,
    Lock,
    Gauge,
    HardDrives,
    Check,
    CircleNotch,
    Lightning,
    Sparkle,
    CaretDown,
    Quotes,
    GithubLogo,
    CreditCard,
    Link as LinkIcon,
    ArrowsClockwise,
    X
} from '@phosphor-icons/react'

function getTestimonials(): Testimonial[] {
    return [
        {
            quote: t('landing.testimonial1Quote'),
            author: t('landing.testimonial1Author'),
            role: t('landing.testimonial1Role'),
            avatar: 'AC'
        },
        {
            quote: t('landing.testimonial2Quote'),
            author: t('landing.testimonial2Author'),
            role: t('landing.testimonial2Role'),
            avatar: 'MS'
        },
        {
            quote: t('landing.testimonial3Quote'),
            author: t('landing.testimonial3Author'),
            role: t('landing.testimonial3Role'),
            avatar: 'JW'
        },
        {
            quote: t('landing.testimonial4Quote'),
            author: t('landing.testimonial4Author'),
            role: t('landing.testimonial4Role'),
            avatar: 'SK'
        }
    ]
}

function getFaqs(): Faq[] {
    return [
        {
            question: t('landing.faq1Question'),
            answer: t('landing.faq1Answer')
        },
        {
            question: t('landing.faq2Question'),
            answer: t('landing.faq2Answer')
        },
        {
            question: t('landing.faq3Question'),
            answer: t('landing.faq3Answer')
        },
        {
            question: t('landing.faq4Question'),
            answer: t('landing.faq4Answer')
        },
        {
            question: t('landing.faq5Question'),
            answer: t('landing.faq5Answer')
        },
        {
            question: t('landing.faq6Question'),
            answer: t('landing.faq6Answer')
        },
        {
            question: t('landing.faq7Question'),
            answer: t('landing.faq7Answer')
        },
        {
            question: t('landing.faq8Question'),
            answer: t('landing.faq8Answer')
        }
    ]
}

const Landing: FC = (): ReactNode => {
    const { user } = useAuth()
    const [pricingProvider, setPricingProvider] =
        useState<ProviderType>('hetzner')
    const { plans, isLoading: plansLoading } = usePlans(pricingProvider)
    const { data: gitHubStars } = useGitHubStars()
    const { showToast } = useUIStore()

    const [openFaq, setOpenFaq] = useState<number | null>(null)
    const [activeSection, setActiveSection] = useState('')
    const [mockClaws, setMockClaws] = useState<MockClawData[]>(initialMockClaws)

    const handleStart = (id: string) => {
        setMockClaws((prev) =>
            prev.map((claw) =>
                claw.id === id ? { ...claw, status: 'running' } : claw
            )
        )
        showToast(t('landing.demoClawStarted'), 'success')
    }

    const handleStop = (id: string) => {
        setMockClaws((prev) =>
            prev.map((claw) =>
                claw.id === id ? { ...claw, status: 'stopped' } : claw
            )
        )
        showToast(t('landing.demoClawStopped'), 'success')
    }

    const handleRestart = (id: string) => {
        setMockClaws((prev) =>
            prev.map((claw) =>
                claw.id === id ? { ...claw, status: 'restarting' } : claw
            )
        )
        showToast(t('landing.demoClawRestarting'), 'success')
        setTimeout(() => {
            setMockClaws((prev) =>
                prev.map((claw) =>
                    claw.id === id ? { ...claw, status: 'running' } : claw
                )
            )
            showToast(t('landing.demoClawRestarted'), 'success')
        }, 2000)
    }

    const handleDelete = (id: string) => {
        setMockClaws((prev) => prev.filter((claw) => claw.id !== id))
        showToast(t('landing.demoClawDeleted'), 'success')
    }

    useEffect(() => {
        const handleScroll = () => {
            const sections = [
                'how-it-works',
                'features',
                'testimonials',
                'pricing',
                'comparison',
                'faq'
            ]
            for (const section of sections.reverse()) {
                const el = document.getElementById(section)
                if (el && window.scrollY >= el.offsetTop - 100) {
                    setActiveSection(section)
                    break
                }
            }
            if (window.scrollY < 200) setActiveSection('')
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const navLinks = [
        {
            label: t('landing.howItWorks'),
            href: '#how-it-works',
            id: 'how-it-works'
        },
        { label: t('landing.features'), href: '#features', id: 'features' },
        {
            label: t('landing.testimonials'),
            href: '#testimonials',
            id: 'testimonials'
        },
        { label: t('landing.pricing'), href: '#pricing', id: 'pricing' },
        {
            label: t('landing.comparison'),
            href: '#comparison',
            id: 'comparison'
        },
        { label: t('landing.faqTitle'), href: '#faq', id: 'faq' }
    ]

    return (
        <div className='font-satoshi min-h-screen bg-[#0a0a0f] text-white'>
            <PageTitle
                title={t('landing.title')}
                description={t('landing.description')}
            />

            <div className='landing-gradient pointer-events-none fixed inset-0' />

            <Header
                showNavLinks={true}
                navLinks={navLinks}
                activeSection={activeSection}
            />

            <section className='relative overflow-hidden px-6 pb-24 pt-32'>
                <div className='landing-grid pointer-events-none' />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className='relative mx-auto max-w-6xl'
                >
                    <div className='flex flex-col items-center text-center'>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className='glow-border mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2'
                        >
                            <Sparkle
                                className='h-4 w-4 text-[#ef5350]'
                                weight='fill'
                            />
                            <span className='text-sm text-gray-300'>
                                {t('landing.badge')}
                            </span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className='font-clash mb-6 text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl lg:text-8xl'
                        >
                            <span className='bg-gradient-to-b from-white via-white to-gray-400 bg-clip-text text-transparent'>
                                {t('landing.heroTitle1')}
                            </span>
                            <br />
                            <span className='animate-gradient bg-gradient-to-r from-[#ef5350] via-[#ff7043] to-[#ffab91] bg-clip-text text-transparent'>
                                {t('landing.heroTitle2')}
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className='mb-10 max-w-2xl text-lg leading-relaxed text-[#8892b0] md:text-xl'
                        >
                            {t('landing.heroDescription')}
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className='mb-16 flex flex-col gap-4 sm:flex-row'
                        >
                            <Button
                                size='lg'
                                className='gap-2 border-0 bg-gradient-to-r from-[#ef5350] to-[#c62828] px-6 font-semibold text-white hover:opacity-90'
                                asChild
                            >
                                <Link to={user ? ROUTES.CLAWS : ROUTES.LOGIN}>
                                    <Lightning
                                        className='h-5 w-5'
                                        weight='fill'
                                    />
                                    {t('nav.deployOpenClaw')}
                                </Link>
                            </Button>
                            <Button
                                size='lg'
                                variant='outline'
                                className='gap-2 border-white/20 bg-white/5 px-6 text-white hover:bg-white/10'
                                asChild
                            >
                                <a
                                    href={GITHUB_REPO_URL}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    <GithubLogo
                                        className='h-5 w-5'
                                        weight='fill'
                                    />
                                    {t('landing.selfHost')}

                                    {gitHubStars && (
                                        <span className='flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-xs'>
                                            {gitHubStars.formatted}
                                            <span className='text-[12px]'>
                                                ★
                                            </span>
                                        </span>
                                    )}
                                </a>
                            </Button>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className='flex items-center gap-8 text-center md:gap-16'
                        >
                            <div>
                                <div className='font-clash text-3xl font-bold text-white md:text-4xl'>
                                    $19/mo
                                </div>
                                <div className='text-sm text-gray-500'>
                                    {t('landing.startingPrice')}
                                </div>
                            </div>
                            <div className='h-12 w-px bg-white/10' />
                            <div>
                                <div className='font-clash text-3xl font-bold text-white md:text-4xl'>
                                    30+
                                </div>
                                <div className='text-sm text-gray-500'>
                                    {t('landing.locations')}
                                </div>
                            </div>
                            <div className='h-12 w-px bg-white/10' />
                            <div>
                                <div className='font-clash text-3xl font-bold text-white md:text-4xl'>
                                    45+
                                </div>
                                <div className='text-sm text-gray-500'>
                                    {t('landing.servers')}
                                </div>
                            </div>
                            <div className='h-12 w-px bg-white/10' />
                            <div>
                                <div className='font-clash text-3xl font-bold text-white md:text-4xl'>
                                    Zero
                                </div>
                                <div className='text-sm text-gray-500'>
                                    {t('landing.zeroConfig')}
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.6 }}
                        className='mx-auto mt-20 max-w-4xl'
                    >
                        <div className='glow-border overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1f]/90 shadow-2xl backdrop-blur-sm'>
                            <div className='flex items-center gap-2 border-b border-white/10 bg-[#2a2a30] px-4 py-3'>
                                <div className='h-3 w-3 rounded-full bg-[#ff5f57]' />
                                <div className='h-3 w-3 rounded-full bg-[#febc2e]' />
                                <div className='h-3 w-3 rounded-full bg-[#28c840]' />
                                <div className='ml-4 flex items-center gap-2 rounded-md bg-white/5 px-3 py-1 text-xs text-gray-400'>
                                    <Lock className='h-3 w-3' />
                                    alphaclaw.dev/claws
                                </div>
                                <div className='flex-1' />
                            </div>
                            <div className='p-6'>
                                <div className='mb-6 flex items-center justify-between'>
                                    <div>
                                        <h3 className='text-lg font-semibold text-white'>
                                            {t('landing.dashboardPreviewTitle')}
                                        </h3>
                                        <p className='text-sm text-gray-500'>
                                            {mockClaws.length > 0
                                                ? `${mockClaws.length} ${mockClaws.length === 1 ? t('dashboard.claw') : t('dashboard.clawsPlural')}`
                                                : t('dashboard.noClawsYet')}
                                        </p>
                                    </div>
                                    <Link
                                        to={user ? ROUTES.CLAWS : ROUTES.LOGIN}
                                        className='flex items-center gap-2 rounded-lg border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90'
                                    >
                                        <Lightning
                                            className='h-4 w-4'
                                            weight='fill'
                                        />
                                        {t('createClaw.title')}
                                    </Link>
                                </div>
                                <div className='space-y-3'>
                                    <AnimatePresence mode='popLayout'>
                                        {mockClaws.length > 0 ? (
                                            mockClaws.map((claw) => (
                                                <motion.div
                                                    key={claw.id}
                                                    layout
                                                    initial={{
                                                        opacity: 0,
                                                        scale: 0.95
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        scale: 1
                                                    }}
                                                    exit={{
                                                        opacity: 0,
                                                        scale: 0.95,
                                                        height: 0
                                                    }}
                                                    transition={{
                                                        duration: 0.2
                                                    }}
                                                >
                                                    <MockClawCard
                                                        claw={claw}
                                                        onStart={handleStart}
                                                        onStop={handleStop}
                                                        onRestart={
                                                            handleRestart
                                                        }
                                                        onDelete={handleDelete}
                                                    />
                                                </motion.div>
                                            ))
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className='flex flex-col items-center justify-center py-12 text-center'
                                            >
                                                <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5'>
                                                    <HardDrives className='h-8 w-8 text-gray-500' />
                                                </div>
                                                <h4 className='mb-2 text-lg font-semibold text-white'>
                                                    {t('dashboard.noClawsYet')}
                                                </h4>
                                                <p className='max-w-xs text-sm text-gray-500'>
                                                    {t(
                                                        'dashboard.noClawsDescription'
                                                    )}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            <section
                id='how-it-works'
                className='relative scroll-mt-20 px-6 py-24'
            >
                <div className='mx-auto max-w-6xl'>
                    <div className='mb-16 text-center'>
                        <Badge
                            variant='outline'
                            className='mb-4 border-white/10 bg-white/5 text-gray-300'
                        >
                            {t('landing.howItWorks')}
                        </Badge>
                        <h2 className='font-clash mb-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl'>
                            {t('landing.threeStepsToPrivacy')}
                        </h2>
                        <p className='mx-auto max-w-xl text-lg text-[#8892b0]'>
                            {t('landing.howItWorksDescription')}
                        </p>
                    </div>

                    <div className='grid gap-6 md:grid-cols-3'>
                        {[
                            {
                                step: '01',
                                icon: HardDrives,
                                title: t('landing.step1Title'),
                                description: t('landing.step1Description')
                            },
                            {
                                step: '02',
                                icon: ShieldCheck,
                                title: t('landing.step2Title'),
                                description: t('landing.step2Description')
                            },
                            {
                                step: '03',
                                icon: Terminal,
                                title: t('landing.step3Title'),
                                description: t('landing.step3Description')
                            }
                        ].map((item) => (
                            <div
                                key={item.step}
                                className='relative rounded-xl border border-white/10 bg-white/[0.02] p-6'
                            >
                                <div className='font-clash absolute -left-1 -top-3 text-6xl font-bold text-white/5'>
                                    {item.step}
                                </div>
                                <div className='relative pt-6'>
                                    <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-[#ef5350]/20 to-[#c62828]/20'>
                                        <item.icon className='h-6 w-6 text-[#ef5350]' />
                                    </div>
                                    <h3 className='font-clash mb-2 text-xl font-semibold text-white'>
                                        {item.title}
                                    </h3>
                                    <p className='leading-relaxed text-[#8892b0]'>
                                        {item.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section
                id='features'
                className='relative scroll-mt-20 border-t border-white/5 px-6 py-24'
            >
                <div className='mx-auto max-w-6xl'>
                    <div className='mb-16 text-center'>
                        <Badge
                            variant='outline'
                            className='mb-4 border-white/10 bg-white/5 text-gray-300'
                        >
                            {t('landing.features')}
                        </Badge>
                        <h2 className='font-clash mb-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl'>
                            {t('landing.whyAlphaClaw')}
                        </h2>
                        <p className='mx-auto max-w-xl text-lg text-[#8892b0]'>
                            {t('landing.featuresDescription')}
                        </p>
                    </div>

                    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                        {[
                            {
                                icon: Clock,
                                title: t('landing.zeroConfig'),
                                description: t('landing.zeroConfigDescription')
                            },
                            {
                                icon: Lock,
                                title: t('landing.ownedData'),
                                description: t('landing.ownedDataDescription')
                            },
                            {
                                icon: Gauge,
                                title: t('landing.fullSpeed'),
                                description: t('landing.fullSpeedDescription')
                            },
                            {
                                icon: Globe,
                                title: t('landing.globalLocations'),
                                description: t(
                                    'landing.globalLocationsDescription'
                                )
                            },
                            {
                                icon: Terminal,
                                title: t('landing.fullSshAccess'),
                                description: t(
                                    'landing.fullSshAccessDescription'
                                )
                            },
                            {
                                icon: CreditCard,
                                title: t('landing.payAsYouGo'),
                                description: t('landing.payAsYouGoDescription')
                            },
                            {
                                icon: LinkIcon,
                                title: t('landing.customSubdomains'),
                                description: t(
                                    'landing.customSubdomainsDescription'
                                )
                            },
                            {
                                icon: ShieldCheck,
                                title: t('landing.secure'),
                                description: t('landing.secureDescription')
                            },
                            {
                                icon: ArrowsClockwise,
                                title: t('landing.autoUpdates'),
                                description: t('landing.autoUpdatesDescription')
                            }
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className='rounded-xl border border-white/10 bg-white/[0.02] p-6'
                            >
                                <feature.icon className='mb-4 h-8 w-8 text-[#ef5350]' />
                                <h3 className='font-clash mb-2 text-lg font-semibold text-white'>
                                    {feature.title}
                                </h3>
                                <p className='text-sm leading-relaxed text-[#8892b0]'>
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section
                id='testimonials'
                className='relative scroll-mt-20 border-t border-white/5 px-6 py-24'
            >
                <div className='mx-auto max-w-6xl'>
                    <div className='mb-16 text-center'>
                        <Badge
                            variant='outline'
                            className='mb-4 border-white/10 bg-white/5 text-gray-300'
                        >
                            {t('landing.testimonials')}
                        </Badge>
                        <h2 className='font-clash mb-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl'>
                            {t('landing.whatPeopleSay')}
                        </h2>
                        <p className='mx-auto max-w-xl text-lg text-[#8892b0]'>
                            {t('landing.testimonialsDescription')}
                        </p>
                    </div>

                    <div className='grid gap-6 md:grid-cols-2'>
                        {getTestimonials().map((testimonial, i) => (
                            <div
                                key={i}
                                className='rounded-xl border border-white/10 bg-white/[0.02] p-6'
                            >
                                <Quotes
                                    className='mb-4 h-8 w-8 text-[#ef5350]/40'
                                    weight='fill'
                                />
                                <p className='mb-6 leading-relaxed text-gray-300'>
                                    "{testimonial.quote}"
                                </p>
                                <div className='flex items-center gap-3'>
                                    <div className='flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#ef5350] to-[#c62828] text-sm font-medium text-white'>
                                        {testimonial.avatar}
                                    </div>
                                    <div>
                                        <p className='font-medium text-white'>
                                            {testimonial.author}
                                        </p>
                                        <p className='text-sm text-gray-500'>
                                            {testimonial.role}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section
                id='pricing'
                className='relative scroll-mt-20 border-t border-white/5 px-6 py-24'
            >
                <div className='mx-auto max-w-6xl'>
                    <div className='mb-16 text-center'>
                        <Badge
                            variant='outline'
                            className='mb-4 border-white/10 bg-white/5 text-gray-300'
                        >
                            {t('landing.pricing')}
                        </Badge>
                        <h2 className='font-clash mb-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl'>
                            {t('landing.simpleTransparentPricing')}
                        </h2>
                        <p className='mx-auto max-w-xl text-lg text-[#8892b0]'>
                            {t('landing.pricingDescription')}
                        </p>

                        <div className='mt-8 flex justify-center'>
                            <div className='flex rounded-lg border border-white/10 bg-white/5 p-1'>
                                <button
                                    onClick={() =>
                                        setPricingProvider('hetzner')
                                    }
                                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                                        pricingProvider === 'hetzner'
                                            ? 'bg-white/10 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    <ProviderIcon
                                        provider='hetzner'
                                        className='h-4 w-4'
                                    />
                                    {t('createClaw.providerHetzner')}
                                </button>
                                <button
                                    onClick={() =>
                                        setPricingProvider('digitalocean')
                                    }
                                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                                        pricingProvider === 'digitalocean'
                                            ? 'bg-white/10 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    <ProviderIcon
                                        provider='digitalocean'
                                        className='h-4 w-4'
                                    />
                                    {t('createClaw.providerDigitalOcean')}
                                </button>
                                <button
                                    onClick={() => setPricingProvider('vultr')}
                                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                                        pricingProvider === 'vultr'
                                            ? 'bg-white/10 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    <ProviderIcon
                                        provider='vultr'
                                        className='h-4 w-4'
                                    />
                                    {t('createClaw.providerVultr')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {plansLoading ? (
                        <div className='flex items-center justify-center py-12'>
                            <CircleNotch className='h-8 w-8 animate-spin text-gray-400' />
                        </div>
                    ) : plans && plans.length > 0 ? (
                        <>
                            <div className='overflow-x-auto'>
                                <table className='w-full border-collapse'>
                                    <thead>
                                        <tr className='border-b border-white/10'>
                                            <th className='font-clash px-4 py-4 text-left font-semibold text-white'>
                                                {t('landing.planColumn')}
                                            </th>
                                            <th className='font-clash px-4 py-4 text-center font-semibold text-white'>
                                                {t('landing.vCpuColumn')}
                                            </th>
                                            <th className='font-clash px-4 py-4 text-center font-semibold text-white'>
                                                {t('landing.ramColumn')}
                                            </th>
                                            <th className='font-clash px-4 py-4 text-center font-semibold text-white'>
                                                {t('landing.storageColumn')}
                                            </th>
                                            <th className='font-clash px-4 py-4 text-center font-semibold text-white'>
                                                {t('landing.monthlyColumn')}
                                            </th>
                                            <th className='px-4 py-4 text-right'></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {plans.map((plan, index) => {
                                            const totalMonthly = Math.round(
                                                plan.priceMonthly
                                            )
                                            const recommendedPlans: Record<
                                                string,
                                                string
                                            > = {
                                                hetzner: 'cax41',
                                                digitalocean: 's-4vcpu-8gb',
                                                vultr: 'vhp-4c-8gb-amd'
                                            }
                                            const isRecommended =
                                                plan.id ===
                                                recommendedPlans[
                                                    pricingProvider
                                                ]
                                            const tierStarts: Record<string, Record<string, string>> = {
                                                hetzner: {
                                                    cx23: t('landing.tierShared'),
                                                    cax11: t('landing.tierArm'),
                                                    ccx13: t('landing.tierDedicated')
                                                },
                                                vultr: {
                                                    'vc2-2c-4gb': t('landing.tierRegular'),
                                                    'vhp-2c-4gb-amd': t('landing.tierHighPerformance'),
                                                    'vhf-3c-8gb': t('landing.tierHighFrequency')
                                                }
                                            }

                                            const providerTiers = tierStarts[pricingProvider]
                                            const tierLabel = providerTiers?.[plan.id]
                                            const showTier = tierLabel && index > 0

                                            return (
                                                <>
                                                    {showTier && (
                                                        <tr key={`tier-${plan.id}`}>
                                                            <td
                                                                colSpan={6}
                                                                className='px-4 pb-2 pt-6'
                                                            >
                                                                <span className='font-clash text-xs font-semibold uppercase tracking-wider text-gray-500'>
                                                                    {tierLabel}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    <tr
                                                        key={plan.id}
                                                        className={`border-b border-white/5 ${
                                                            isRecommended
                                                                ? 'bg-[#ef5350]/5'
                                                                : ''
                                                        }`}
                                                    >
                                                    <td className='px-4 py-4'>
                                                        <div className='flex items-center gap-2'>
                                                            <span className='font-medium text-white'>
                                                                {plan.name.replace(
                                                                    /([A-Za-z])(\d)/,
                                                                    '$1 $2'
                                                                )}
                                                            </span>
                                                            {isRecommended && (
                                                                    <Badge className='border-0 bg-gradient-to-r from-[#ef5350] to-[#c62828] text-xs text-white'>
                                                                        {t(
                                                                            'landing.recommended'
                                                                        )}
                                                                    </Badge>
                                                                )}
                                                        </div>
                                                    </td>
                                                    <td className='px-4 py-4 text-center text-gray-300'>
                                                        {plan.cpu}
                                                    </td>
                                                    <td className='px-4 py-4 text-center text-gray-300'>
                                                        {plan.memory} GB
                                                    </td>
                                                    <td className='px-4 py-4 text-center text-gray-300'>
                                                        {plan.disk} GB
                                                    </td>
                                                    <td className='px-4 py-4 text-center'>
                                                        <span className='font-clash font-bold text-white'>
                                                            ${totalMonthly}
                                                        </span>
                                                        <span className='text-sm text-gray-500'>
                                                            /mo
                                                        </span>
                                                    </td>
                                                    <td className='px-4 py-4 text-right'>
                                                        <Button
                                                            size='sm'
                                                            className={`gap-2 px-4 ${
                                                                isRecommended
                                                                    ? 'border-0 bg-gradient-to-r from-[#ef5350] to-[#c62828] text-white hover:opacity-90'
                                                                    : 'border-0 bg-white/10 text-white hover:bg-white/20'
                                                            }`}
                                                            asChild
                                                        >
                                                            <Link
                                                                to={
                                                                    user
                                                                        ? `${ROUTES.CLAWS}?plan=${plan.id}`
                                                                        : `${ROUTES.LOGIN}?plan=${plan.id}`
                                                                }
                                                            >
                                                                {user
                                                                    ? t(
                                                                          'landing.deploy'
                                                                      )
                                                                    : t(
                                                                          'landing.select'
                                                                      )}
                                                            </Link>
                                                        </Button>
                                                    </td>
                                                </tr>
                                                </>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className='mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4'>
                                <div className='flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400'>
                                    <div className='flex items-center gap-2'>
                                        <Check className='h-4 w-4 text-green-400' />
                                        <span>
                                            {t('landing.openClawPreinstalled')}
                                        </span>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        <Check className='h-4 w-4 text-green-400' />
                                        <span>
                                            {t('landing.unlimitedBandwidth')}
                                        </span>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        <Check className='h-4 w-4 text-green-400' />
                                        <span>
                                            {t('landing.rootSshAccess')}
                                        </span>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        <Check className='h-4 w-4 text-green-400' />
                                        <span>{t('landing.onlineAllDay')}</span>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        <Check className='h-4 w-4 text-green-400' />
                                        <span>
                                            {t('landing.highQualityInternet')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className='py-12 text-center text-gray-400'>
                            {t('errors.unableToLoadPricing')}
                        </div>
                    )}
                </div>
            </section>

            <section
                id='comparison'
                className='relative scroll-mt-20 border-t border-white/5 px-6 py-24'
            >
                <div className='mx-auto max-w-3xl'>
                    <div className='mb-16 text-center'>
                        <Badge
                            variant='outline'
                            className='mb-4 border-white/10 bg-white/5 text-gray-300'
                        >
                            {t('landing.comparison')}
                        </Badge>
                        <h2 className='font-clash mb-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl'>
                            {t('landing.comparisonTitle')}
                        </h2>
                        <p className='mx-auto max-w-xl text-lg text-[#8892b0]'>
                            {t('landing.comparisonDescription')}
                        </p>
                    </div>

                    <div className='overflow-hidden rounded-xl border border-white/10'>
                        <table className='w-full'>
                            <thead>
                                <tr className='border-b border-white/10 bg-white/[0.02]'>
                                    <th className='px-6 py-4'>
                                        <div className='flex items-center justify-center'>
                                            <span className='font-clash text-lg font-bold'>
                                                <span className='bg-gradient-to-r from-[#ef5350] to-[#ff7043] bg-clip-text text-transparent'>Alpha</span>
                                                <span className='text-white'>Claw</span>
                                                <span className='ml-1 text-[#ef5350]'>⚡</span>
                                            </span>
                                        </div>
                                    </th>
                                    <th className='px-6 py-4 text-center'>
                                        <span className='font-medium text-gray-400'>
                                            {t('landing.others')}
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-white/5'>
                                <tr>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <Check className='h-5 w-5 flex-shrink-0 text-green-400' />
                                            <span className='text-white'>
                                                {t(
                                                    'landing.comparisonOpenClawUs'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <X className='h-5 w-5 flex-shrink-0 text-red-400' />
                                            <span className='text-gray-400'>
                                                {t(
                                                    'landing.comparisonOpenClawOthers'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                <tr className='bg-white/[0.01]'>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <Check className='h-5 w-5 flex-shrink-0 text-green-400' />
                                            <span className='text-white'>
                                                {t(
                                                    'landing.comparisonPricingUs'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <X className='h-5 w-5 flex-shrink-0 text-red-400' />
                                            <span className='text-gray-400'>
                                                {t(
                                                    'landing.comparisonPricingOthers'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <Check className='h-5 w-5 flex-shrink-0 text-green-400' />
                                            <span className='text-white'>
                                                {t(
                                                    'landing.comparisonOwnershipUs'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <X className='h-5 w-5 flex-shrink-0 text-red-400' />
                                            <span className='text-gray-400'>
                                                {t(
                                                    'landing.comparisonOwnershipOthers'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                <tr className='bg-white/[0.01]'>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <Check className='h-5 w-5 flex-shrink-0 text-green-400' />
                                            <span className='text-white'>
                                                {t(
                                                    'landing.comparisonSubdomainUs'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <X className='h-5 w-5 flex-shrink-0 text-red-400' />
                                            <span className='text-gray-400'>
                                                {t(
                                                    'landing.comparisonSubdomainOthers'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <Check className='h-5 w-5 flex-shrink-0 text-green-400' />
                                            <span className='text-white'>
                                                {t('landing.comparisonInfraUs')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <X className='h-5 w-5 flex-shrink-0 text-red-400' />
                                            <span className='text-gray-400'>
                                                {t(
                                                    'landing.comparisonInfraOthers'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                <tr className='bg-white/[0.01]'>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <Check className='h-5 w-5 flex-shrink-0 text-green-400' />
                                            <span className='text-white'>
                                                {t('landing.comparisonDataUs')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <X className='h-5 w-5 flex-shrink-0 text-red-400' />
                                            <span className='text-gray-400'>
                                                {t(
                                                    'landing.comparisonDataOthers'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <Check className='h-5 w-5 flex-shrink-0 text-green-400' />
                                            <span className='text-white'>
                                                {t(
                                                    'landing.comparisonMultipleUs'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    <td className='px-6 py-4'>
                                        <div className='flex items-center gap-3'>
                                            <X className='h-5 w-5 flex-shrink-0 text-red-400' />
                                            <span className='text-gray-400'>
                                                {t(
                                                    'landing.comparisonMultipleOthers'
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section
                id='faq'
                className='relative scroll-mt-20 border-t border-white/5 px-6 py-24'
            >
                <div className='mx-auto max-w-3xl'>
                    <div className='mb-16 text-center'>
                        <Badge
                            variant='outline'
                            className='mb-4 border-white/10 bg-white/5 text-gray-300'
                        >
                            {t('landing.faqTitle')}
                        </Badge>
                        <h2 className='font-clash mb-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl'>
                            {t('landing.frequentlyAskedQuestions')}
                        </h2>
                        <p className='mx-auto max-w-xl text-lg text-[#8892b0]'>
                            {t('landing.faqDescription')}
                        </p>
                    </div>

                    <div className='space-y-3'>
                        {getFaqs().map((faq, i) => (
                            <div
                                key={i}
                                className='overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]'
                            >
                                <button
                                    onClick={() =>
                                        setOpenFaq(openFaq === i ? null : i)
                                    }
                                    className='flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-white/[0.02]'
                                >
                                    <span className='pr-4 font-medium text-white'>
                                        {faq.question}
                                    </span>
                                    <CaretDown
                                        className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform duration-200 ${
                                            openFaq === i ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>
                                <AnimatePresence>
                                    {openFaq === i && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{
                                                height: 'auto',
                                                opacity: 1
                                            }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className='overflow-hidden'
                                        >
                                            <div className='px-5 pb-5'>
                                                <p className='leading-relaxed text-[#8892b0]'>
                                                    {faq.answer}
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className='relative border-t border-white/5 px-6 py-32'>
                <div className='mx-auto max-w-4xl text-center'>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className='font-clash mb-6 text-4xl font-bold md:text-6xl'>
                            <span className='bg-gradient-to-b from-white to-gray-300 bg-clip-text text-transparent'>
                                {t('landing.readyToOwnYourPrivacy')}
                            </span>
                        </h2>
                        <p className='mx-auto mb-10 max-w-2xl text-xl text-[#8892b0]'>
                            {t('landing.ctaDescription')}
                        </p>

                        <div className='flex flex-col items-center justify-center gap-4 sm:flex-row'>
                            <Button
                                size='lg'
                                className='gap-2 border-0 bg-gradient-to-r from-[#ef5350] to-[#c62828] px-8 py-6 text-lg font-semibold text-white hover:opacity-90'
                                asChild
                            >
                                <Link to={user ? ROUTES.CLAWS : ROUTES.LOGIN}>
                                    <Lightning
                                        className='h-5 w-5'
                                        weight='fill'
                                    />
                                    {t('landing.deployOpenClawNow')}
                                </Link>
                            </Button>
                            <Button
                                size='lg'
                                variant='outline'
                                className='gap-2 border-white/20 bg-white/5 px-8 py-6 text-lg text-white hover:bg-white/10'
                                asChild
                            >
                                <a
                                    href={GITHUB_REPO_URL}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    <GithubLogo
                                        className='h-5 w-5'
                                        weight='fill'
                                    />
                                    {t('landing.selfHostInstead')}
                                </a>
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </section>

            <LandingFooter />
        </div>
    )
}

export default Landing