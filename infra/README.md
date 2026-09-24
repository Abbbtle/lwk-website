# LWK infrastructure

AWS CDK (TypeScript) app for the Living With Krishna LMS. See `docs/PLAN.md` for the
architecture and which stacks arrive in which phase.

- Account `455280338092`, region `af-south-1` (Cape Town) - set in `lib/config.ts`
- `cfn/budget.yaml` - account budget alerts, deployed as CloudFormation stack
  `lwk-guardrails` in `us-east-1` (Budgets only works there)

## Commands (run from this folder)

- `npm run typecheck` - type-check the CDK app
- `npm run synth` - print the CloudFormation templates
- `npm run diff` - compare with what is deployed (always review before deploying)
- `npm run deploy -- <StackName>` - deploy a stack

The first deploy to a region needs `npx cdk bootstrap aws://455280338092/af-south-1`.
