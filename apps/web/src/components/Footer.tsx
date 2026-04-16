import type { FC, ReactNode } from 'react'

import { Link } from 'react-router-dom'
import { t } from '@openclaw/i18n'

const Footer: FC = (): ReactNode => {
    return (
        <footer className='relative mt-auto border-t border-white/10'>
            <div className='mx-auto max-w-6xl px-6 py-6'>
                <div className='flex flex-col items-center justify-between gap-4 sm:flex-row'>
                    <p className='text-muted-foreground text-sm'>
                        &copy; {new Date().getFullYear()}{' '}
                        {t('footer.copyright')}
                    </p>
                    <div className='flex items-center gap-6'>
                        <Link
                            to='/terms'
                            className='text-muted-foreground hover:text-foreground text-sm transition-colors'
                        >
                            {t('footer.termsOfService')}
                        </Link>
                        <Link
                            to='/privacy'
                            className='text-muted-foreground hover:text-foreground text-sm transition-colors'
                        >
                            {t('footer.privacyPolicy')}
                        </Link>
                        <Link
                            to='/changelog'
                            className='text-muted-foreground hover:text-foreground text-sm transition-colors'
                        >
                            {t('footer.changelog')}
                        </Link>
                        <a
                            href='mailto:support@alphaclaw.dev'
                            className='text-muted-foreground hover:text-foreground text-sm transition-colors'
                        >
                            {t('footer.getInTouch')}
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    )
}

export { Footer }