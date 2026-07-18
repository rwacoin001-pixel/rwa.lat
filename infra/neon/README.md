# Neon provisioning status

The previous generated `main.tf` mixed Markdown with HCL, referenced a wrong provider source and unsupported grant/revoke resources, and would not pass `terraform validate`. It was intentionally removed instead of being applied to a paid production account.

Before a reviewed Neon module is created, confirm:

1. Neon organization and paid plan;
2. region and data-residency requirement;
3. private networking or IP allow-list design;
4. protected production branch and PITR retention;
5. encrypted remote Terraform state and approvers;
6. separate migration, Core runtime and Admin runtime database roles;
7. where generated role passwords are written in Secret Manager;
8. cost and deletion-protection policy.

No `terraform apply` should be run from this directory until those decisions are recorded. The provider currently sponsored by Neon is `kislerdm/neon`; pin a reviewed version and commit `.terraform.lock.hcl` when infrastructure ownership is established.
