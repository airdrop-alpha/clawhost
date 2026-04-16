import type { Translations } from './langs/en'

type NestedKeyOf<T> = T extends object
    ? {
          [K in keyof T & string]: T[K] extends object
              ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
              : `${K}`
      }[keyof T & string]
    : never

export type TranslationKey = NestedKeyOf<Translations>

export type Languages = 'en' | 'zh'