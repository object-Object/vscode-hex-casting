# Publishing

## Setup

1. In Azure, [create a new Entra application / service principal](https://learn.microsoft.com/entra/identity-platform/howto-create-service-principal-portal). Leave the Redirect URI empty.
2. Assign the Reader role to the application.
   - You may be able to create a custom role with fewer permissions than Reader to limit which resources are visible to the application. I'm not sure what the minimum required permissions are.
3. [Add a federated credential to the application](https://learn.microsoft.com/en-ca/entra/workload-id/workload-identity-federation-create-trust#github-actions):
   - Federated credential scenario: GitHub Actions deploying Azure resources
   - Organization: GitHub username (eg. `object-Object`)
   - Repository: GitHub repository name (eg. `vscode-hex-casting`)
   - Entity type: Environment
   - Environment: `azure`
4. [Create a new client secret](https://learn.microsoft.com/en-ca/entra/identity-platform/howto-create-service-principal-portal#option-3-create-a-new-client-secret) for the application.
5. Using the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli), run the following commands to [get the application's user ID](https://learn.microsoft.com/en-us/azure/devops/extend/publish/command-line#publish-with-a-microsoft-entra-token-as-a-service-principal):
   ```sh
   az login --service-principal --username APPLICATION_ID --password CLIENT_SECRET --tenant TENANT_ID
   az rest -u https://app.vssps.visualstudio.com/_apis/profile/profiles/me --resource 499b84ac-1321-427f-aa17-267ca6975798 --query id --output tsv
   az logout
   ```
6. [Add the application to your Marketplace publisher as a member](https://learn.microsoft.com/en-us/visualstudio/extensibility/walkthrough-publishing-a-visual-studio-extension#add-additional-users-to-manage-your-publisher-account).
   - User ID: The UUID found in the previous step
   - Role: Contributor (Creator is not sufficient)
7. Delete the client secret (not the federated credential).
8. In your GitHub repository, [create an environment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) called `azure`.
9. Add the following variables (or secrets, if you update [release.yml](.github/workflows/release.yml) to match) to the `azure` environment:
   - `AZURE_CLIENT_ID`: Application (client) ID of the application
   - `AZURE_TENANT_ID`: Directory (tenant) ID of the application
   - `AZURE_SUBSCRIPTION_ID`: Subscription ID of the subscription where the Reader role was assigned
10. Run the [release.yml](.github/workflows/release.yml) workflow in dry-run mode to test the credentials.

## Release process

1. Add a new entry in [CHANGELOG.md](CHANGELOG.md).
2. Bump the version with `yarn version`, eg. `yarn version --patch`.
3. Push the new commits and tag, eg. `git push origin main v0.2.4`.
