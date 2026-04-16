import type { Translations } from './langs/en'
import type { Languages } from './types'

import { en } from './langs/en'
import { zh } from './langs/zh'

const state: {
    languages: Record<Languages, Translations>
    currentLanguage: Languages
} = {
    languages: { en, zh: zh as unknown as Translations },
    currentLanguage: 'zh'
}

export default state