# NextIn by Wintek

Queue management SaaS — virtual tickets for clinics, telecom operators, banks and utilities in Cameroon.

- Architecture plan: [`docs/PLAN.md`](docs/PLAN.md)
- Project conventions (incl. Apple HIG design rules): [`CLAUDE.md`](CLAUDE.md)
- Module notes: [`docs/modules/`](docs/modules)

```bash
pnpm install
cp .env.example apps/web/.env.local   # fill in values
pnpm db:start && pnpm db:test
pnpm dev                              # http://localhost:3000/design
```
