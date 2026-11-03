import { redirect } from 'next/navigation'

// The daily settlement moved to the guided flow at /quant/daily.
export default function QuantSettlementPage() {
  redirect('/quant/daily')
}
