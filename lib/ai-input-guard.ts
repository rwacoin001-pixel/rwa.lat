import englishWords from './bip39-english.json'

// Public BIP39 English dictionary, MIT licensed, from:
// https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt
// Detect dictionary runs without deriving a key or requiring a valid checksum:
// a dictionary-composed phrase with an invalid checksum is still blocked.
const recoveryWords=new Set(englishWords)
export function containsWalletSecret(message:string):boolean {
  if(/\b(?:0x)?[0-9a-f]{64}\b/i.test(message)) return true
  let consecutive=0
  for(const token of message.normalize('NFKD').toLowerCase().split(/[^a-z]+/)) {
    consecutive=recoveryWords.has(token)?consecutive+1:0
    if(consecutive>=12) return true
  }
  return false
}
