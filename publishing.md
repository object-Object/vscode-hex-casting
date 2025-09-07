# Publishing

## Setup

1. In Azure, [create a managed identity](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/how-manage-user-assigned-managed-identities?pivots=identity-mi-methods-azp#create-a-user-assigned-managed-identity).
2. [Add a federated credential to the managed identity](https://learn.microsoft.com/entra/workload-id/workload-identity-federation-create-trust-user-assigned-managed-identity?pivots=identity-wif-mi-methods-azp#github-actions-deploying-azure-resources):
   - Scenario: GitHub Actions deploying Azure resources
   - Organization: `object-Object`
   - Repository: `vscode-hex-casting`
   - Entity: Environment
   - Environment: `azure`
3. In Azure DevOps, [add the managed identity to the organization](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/service-principal-managed-identity?view=azure-devops#step-2-add-the-identity-to-azure-devops).
4. In the GitHub repository, [create an environment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) called `azure`.
5. Add the following secrets to the `azure` environment:
   - `AZURE_CLIENT_ID`: managed identity client ID
   - `AZURE_SUBSCRIPTION_ID`: managed identity subscription ID
   - `AZURE_TENANT_ID`: [Microsoft Entra tenant ID](https://learn.microsoft.com/en-us/azure/active-directory-b2c/tenant-management-read-tenant-name)

## Release process

1. Add a new entry in [CHANGELOG.md](CHANGELOG.md).
2. Bump the version with `yarn version`, eg. `yarn version --patch`.
3. Push the new commits and tag, eg. `git push origin main v0.2.4`.
