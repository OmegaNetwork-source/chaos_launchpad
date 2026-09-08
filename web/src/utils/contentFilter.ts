/**
 * Content safety filter for token creation.
 * Validates text fields against harmful content patterns.
 * Designed to be portable for server-side use.
 */

export interface ContentFilterResult {
  isValid: boolean
  field?: 'name' | 'symbol' | 'description' | 'twitter' | 'telegram' | 'website' | 'discord'
}

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  '$': 's',
  '!': 'i',
}

function normalize(text: string): string {
  let normalized = text.toLowerCase()
  
  for (const [leet, letter] of Object.entries(LEET_MAP)) {
    normalized = normalized.split(leet).join(letter)
  }
  
  normalized = normalized.replace(/[^a-z]/g, '')
  
  return normalized
}

const BLOCKLIST: string[] = [
  // Racial slurs
  'nigger', 'nigga', 'nigg', 'negro', 'coon', 'spic', 'chink', 'gook', 'kike',
  'wetback', 'beaner', 'raghead', 'towelhead', 'sandnigger', 'paki', 'cracker',
  'honky', 'gringo', 'darkie', 'jigaboo', 'sambo', 'zipperhead', 'slant',
  
  // Anti-LGBTQ slurs  
  'faggot', 'fag', 'dyke', 'tranny', 'shemale',
  
  // Religious hatred
  'kike', 'kyke',
  
  // Disability slurs
  'retard', 'retarded', 'tard',
  
  // Nazi/white supremacy
  'nazi', 'hitler', 'heil', 'sieg', 'aryan', 'whitepride', 'whitepower',
  'kkk', 'klux', 'skinhead', 'neonazi', 'fascist',
  
  // Violence glorification
  'killall', 'genocide', 'lynch', 'exterminate',
  
  // CSAM-related (hard block)
  'childporn', 'kidporn', 'pedo', 'pedophile', 'pedophilia', 'lolicon', 'shotacon',
  
  // Terrorism
  'jihad', 'terrorist', 'alqaeda', 'isis', 'isil', 'taliban',
  
  // Self-harm
  'killmyself', 'killurself', 'killyourself', 'suicide', 'cutmyself',
]

const PATTERN_RULES: RegExp[] = [
  /n+[i1!]+g+[aeo4]+[rh]?s?/i,
  /f+[a@4]+g+[s$]?/i,
  /k+[i1!]+k+[e3]+s?/i,
  /h+[e3]+[i1!]+l+\s*h+[i1!]+t+l+[e3]+r/i,
  /wh+[i1!]+t+[e3]+\s*p+[o0]+w+[e3]+r/i,
  /wh+[i1!]+t+[e3]+\s*pr+[i1!]+d+[e3]/i,
  /r+[a@4]+c+[e3]+\s*w+[a@4]+r/i,
  /[e3]+th+n+[i1!]+c+\s*cl+[e3]+[a@4]+n+s/i,
  /d+[e3]+[a@4]+th+\s*t+[o0]+\s*(jews?|blacks?|muslims?|gays?|trans)/i,
  /k+[i1!]+l+l+\s*(all\s*)?(jews?|blacks?|muslims?|gays?|trans|immigrants?)/i,
]

function containsBlockedTerm(normalized: string): boolean {
  for (const term of BLOCKLIST) {
    if (normalized.includes(term)) {
      return true
    }
  }
  return false
}

function matchesPattern(original: string): boolean {
  for (const pattern of PATTERN_RULES) {
    if (pattern.test(original)) {
      return true
    }
  }
  return false
}

function isHarmful(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false
  }
  
  const normalized = normalize(text)
  
  if (containsBlockedTerm(normalized)) {
    return true
  }
  
  if (matchesPattern(text)) {
    return true
  }
  
  return false
}

export interface TokenFields {
  name?: string
  symbol?: string
  description?: string
  twitter?: string
  telegram?: string
  website?: string
  discord?: string
}

export function validateTokenContent(fields: TokenFields): ContentFilterResult {
  const checks: Array<{ field: ContentFilterResult['field']; value?: string }> = [
    { field: 'name', value: fields.name },
    { field: 'symbol', value: fields.symbol },
    { field: 'description', value: fields.description },
    { field: 'twitter', value: fields.twitter },
    { field: 'telegram', value: fields.telegram },
    { field: 'website', value: fields.website },
    { field: 'discord', value: fields.discord },
  ]
  
  for (const { field, value } of checks) {
    if (value && isHarmful(value)) {
      return { isValid: false, field }
    }
  }
  
  return { isValid: true }
}

export function validateSingleField(
  value: string,
  field: ContentFilterResult['field']
): ContentFilterResult {
  if (isHarmful(value)) {
    return { isValid: false, field }
  }
  return { isValid: true }
}
