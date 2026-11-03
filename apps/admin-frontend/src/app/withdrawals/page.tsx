import { redirect } from 'next/navigation'

// Review, broadcast and the execution switch all live in /funds/withdrawals now.
export default function WithdrawalsPage() {
  redirect('/funds/withdrawals')
}
