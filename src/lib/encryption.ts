import CryptoJS from 'crypto-js'

if (!process.env.ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required but not set')
}

const ENCRYPTION_KEY: string = process.env.ENCRYPTION_KEY

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString()
}

export function decrypt(encryptedText: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    // Log sin exponer detalles sensibles del error
    console.error('Decryption failed - invalid encrypted data or key mismatch')
    return ''
  }
}

export function encryptObject(obj: any): string {
  return encrypt(JSON.stringify(obj))
}

export function decryptObject<T>(encryptedText: string): T | null {
  try {
    const decrypted = decrypt(encryptedText)
    return decrypted ? JSON.parse(decrypted) : null
  } catch (error) {
    // Log sin exponer detalles sensibles del error
    console.error('Object decryption failed - invalid JSON or encryption key')
    return null
  }
}
