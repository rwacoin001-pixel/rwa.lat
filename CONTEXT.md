# RWA.LAT Identity and Compliance

This language separates account access, legal identity, compliance review, and investment permission so no single “verified” flag can bypass a required decision.

## Language

**User**:
The platform account that owns settings and references financial and compliance records.
_Avoid_: Identity, login

**Login Identity**:
A verified or pending credential that can authenticate a User, such as an email, OAuth subject, or external wallet address.
_Avoid_: Account, legal identity

**Legal Identity**:
The encrypted personal identity attributes associated with a User and used as input to compliance review.
_Avoid_: Login identity, KYC status

**Session**:
A revocable authenticated presence of a User on a specific Device.
_Avoid_: Login identity

**Device**:
A client installation or browser recognized for security and trust decisions.
_Avoid_: Session

**KYC Case**:
A provider-backed review of a Legal Identity, with its own evidence, status, and result timeline.
_Avoid_: Eligibility, verified user

**Eligibility Profile**:
A versioned decision about what a User may browse or invest in under a policy and product scope.
_Avoid_: KYC status, risk score

**Risk Flag**:
A reviewable signal about a User or related activity; it is evidence for a decision, not the decision itself.
_Avoid_: Rejection, ban

**Audit Record**:
An immutable record of a sensitive read, decision, or state-changing action.
_Avoid_: Application log

## Wallet and Ledger Language

**Custody Wallet**:
A provider-backed wallet container associated with a User. It holds an encrypted provider reference but is not the source of truth for the User's spendable balance.
_Avoid_: Ledger account, balance

**Chain Transaction**:
An observed transaction on a supported blockchain, identified by network and transaction hash. Its confirmations are external evidence, not a ledger posting by themselves.
_Avoid_: Deposit, withdrawal, ledger transaction

**Ledger Account**:
A single-purpose accounting bucket for one asset and decimal scale, such as User Available or Platform Settlement.
_Avoid_: Custody wallet, blockchain address

**Ledger Transaction**:
An immutable, idempotent accounting voucher that groups balanced Ledger Entries and references the business operation that caused them.
_Avoid_: Chain transaction, mutable workflow state

**Ledger Entry**:
An immutable debit or credit in the asset's smallest integer unit. Entries are corrected with a new reversal or adjustment transaction, never edited in place.
_Avoid_: Floating-point amount, balance

**Balance Projection**:
The row-locked current balance derived transactionally from Ledger Entries and used to prevent concurrent overspending. It is a rebuildable cache, not the accounting source of truth.
_Avoid_: Ledger entry, external custody balance

**Balance Snapshot**:
An immutable account balance recorded after a specific Ledger Entry for audit and historical reconstruction.
_Avoid_: Mutable current balance
