---
name: deployment
load_when: deploying, configuring production, or debugging hosting
depends_on: [00-rules, 42-auth-server]
related: [51-frontend]
code: deploy config, .env.example
---

# Deployment

## 10. Deployment (mandatory)

- **YOU**: choose hosts. A common free-tier arrangement is the frontend on Vercel, the backend on a free web-service host, and MongoDB Atlas on its free cluster. Check each provider's current free-tier terms, because they change.
- **AGENT**: production config, CORS or proxy settings, `.env.example`, a health endpoint.
- **GUIDE (production issues to plan for)**:
  - Some free backends sleep after inactivity and take tens of seconds to wake. Note this in the README, and make the frontend show a "Waking the server" state instead of an error on the first request.
  - Long generation cannot run inside one HTTP request on any free host. That is why generation runs as a background job with polling (6.15).
  - A server restart loses in-process jobs. Handle it as described in 6.15.
  - Cookies across two domains: use the proxy approach in 6.1, or configure `SameSite=None; Secure` and CORS credentials.
  - Set `NODE_ENV=production`, leave `ALLOW_PRIVATE_HOSTS` unset, and confirm the deployed crawler rejects `http://127.0.0.1`.
- **YOU**: manage secrets. Never commit keys. Rotate any key that ever appeared in a commit. Document each variable in `.env.example`.
- **Test yourself**: on your phone, open the deployed URL, register, create a kit, close the browser during generation, reopen it and find the kit finished.

## Done when
- The deployed frontend and backend are both reachable.
- A phone test passes: register, create a kit, close the browser during generation, reopen, find it finished.
- The deployed crawler rejects http://127.0.0.1 and ALLOW_PRIVATE_HOSTS is unset.
- Every environment variable is documented and no secret is committed.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
