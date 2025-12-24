/**
 * Utilidades para formateo de datos
 */

// Palabras que deben permanecer en minúsculas (preposiciones, artículos)
const LOWERCASE_WORDS = ['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'o', 'u']

/**
 * Convierte un nombre a formato Título (Title Case)
 * Ejemplo: "CHRISTIAN PALOMINO" -> "Christian Palomino"
 * Ejemplo: "mario de la cruz" -> "Mario de la Cruz"
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return ''

  return str
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0) // Eliminar espacios extras
    .map((word, index) => {
      // Si es la primera palabra o no es una preposición/artículo, capitalizar
      if (index === 0 || !LOWERCASE_WORDS.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1)
      }
      return word
    })
    .join(' ')
}

/**
 * Formatea un email a minúsculas y sin espacios
 */
export function formatEmail(email: string | null | undefined): string {
  if (!email) return ''
  return email.trim().toLowerCase()
}

/**
 * Formatea un username a mayúsculas y sin espacios
 */
export function formatUsername(username: string | null | undefined): string {
  if (!username) return ''
  return username.trim().toUpperCase()
}
