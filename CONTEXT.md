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
