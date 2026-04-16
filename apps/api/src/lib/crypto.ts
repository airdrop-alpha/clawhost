import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY
    if (!key) throw new Error('ENCRYPTION_KEY environment variable is required')
    // Key must be 64 hex chars = 32 bytes
    if (key.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
    return Buffer.from(key, 'hex')
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64 string: iv(16) + tag(16) + ciphertext
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypt a value encrypted by encrypt().
 */
export function decrypt(encryptedBase64: string): string {
    const key = getEncryptionKey()
    const data = Buffer.from(encryptedBase64, 'base64')
    const iv = data.subarray(0, IV_LENGTH)
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(ciphertext) + decipher.final('utf8')
}