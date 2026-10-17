> **保留的参考文档，2026-10-16 仅更新品牌与公开域名。** 本轮未重新验证文中的能力、流程、法律状态或供应商配置；当前部署事实见[当前项目说明](../deployment-current.md)。

# Encrypt sensitive identity data and query by keyed hashes

A-REIT stores recoverable identity values as application-encrypted ciphertext with a key version, while equality lookups and uniqueness use non-reversible keyed hashes. This avoids plaintext email, wallet, OAuth, KYC identifiers, and legal-identity attributes in PostgreSQL without losing deterministic conflict detection; key material remains outside the database. JSON evidence and audit fields may contain only redacted references, reason codes, and non-sensitive operational context—never raw identity attributes—and changing this representation later would require a sensitive-data migration.
