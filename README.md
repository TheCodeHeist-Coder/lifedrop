# RaktDoot

Finds blood donors for a family in an emergency. Give a blood group and location, or paste the forwarded WhatsApp appeal. RaktDoot contacts nearby compatible, eligible donors on WhatsApp in widening waves, and shows the family who is coming.

Built for hackCBS 9.0, HealthTech. **Final submission: Sunday 1 November, 12:00 PM.** Submissions open at 10:00 AM.

## Run it

Needs Node 24 and Docker.

```bash
docker run -d --name raktdoot-yb -p 127.0.0.1:5433:5433 yugabytedb/yugabyte:2026.1.2.0-b137 \
  bin/yugabyted start --background=false --ui=false

cp .env.example .env.local
npm install
npm run db:setup -- --seed   # creates tables and 300 simulated donors
npm run build
npm start                    # http://localhost:3000
npm test                     # needs the database running
```

If YugabyteDB says `insufficient disk space`, add this to the end of the `docker run` line:

```
--tserver_flags="reject_writes_min_disk_space_mb=200,reject_writes_min_disk_space_pct=0" --master_flags="reject_writes_min_disk_space_mb=200,reject_writes_min_disk_space_pct=0"
```

| Page | What it is |
|---|---|
| `/` | Landing page |
| `/request` | Family's request form |
| `/r/<id>` | Live request status |
| `/donate` | Donor registration |
| `/demo` | Presenter console: plays simulated donors. Needs `DEMO_MODE=true` |

It runs with no accounts. Without Twilio, WhatsApp messages stay in `/demo`. Without Gemini, a rule-based parser reads appeals.

## Turn on the real services

**Twilio WhatsApp**

1. Create a Twilio account and open Messaging > Try it out > Send a WhatsApp message.
2. Put `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `NEXT_PUBLIC_TWILIO_SANDBOX_CODE` in `.env.local`.
3. Get a public HTTPS address, either from a server or a tunnel such as `cloudflared tunnel --url http://localhost:3000`, and set it as `PUBLIC_URL`.
4. In the sandbox settings, set "When a message comes in" to `<PUBLIC_URL>/api/whatsapp/webhook`, using POST.
5. Rebuild and restart, because `NEXT_PUBLIC_` values are fixed at build time.
6. On each demo phone: send `join <code>` to the sandbox number, register at `/donate`, then send `HI`.

Sandbox rules that matter on stage:

- Only joined phones receive messages. Everyone else fails with error 63015.
- One message every 3 seconds. The app queues sends, so a wave of real phones takes time.
- A phone must have messaged the bot in the last 24 hours, or free-form alerts will not arrive. **Send `HI` from every demo phone shortly before pitching.**
- Sandbox membership lasts 3 days.

**Gemini.** Set `GEMINI_API_KEY`. The model is `GEMINI_MODEL`.

**YugabyteDB Aeon.** Create a free sandbox cluster, download its CA certificate as `root.crt`, allow your server's IP, and set `DATABASE_URL` as shown in `.env.example`. Then run `npm run db:setup -- --seed`.

**Hosting.** Run it as one long-lived Node server. Vercel and other serverless hosts will not work: the send queue lives in memory, and the status page's polling is what moves a search forward.

## Demo script (3 minutes)

Before going on stage: reset in `/demo`, reseed with `npm run db:setup -- --seed`, and send `HI` from your demo phones.

1. **The problem.** Show a real-looking forwarded appeal. Families today post these into groups and hope.
2. **Paste it.** On `/request`, open the paste box and use a sample from `/demo`. The form fills itself. Point at the blood group check.
3. **Find donors.** The status page shows wave 1, and that recent donors were skipped automatically.
4. **A phone buzzes.** A registered team phone gets the alert. Reply `YES` live.
5. **The family sees it.** The donor appears with Call and WhatsApp buttons. Their number was hidden until now.
6. **The hard case.** Use the "Remote district" sample and press "All waiting demo donors say NO". The search widens to 300 km, then sends the family to eRaktKosh stock search.

## How it works

```
Family form or pasted appeal
        |  rules and Gemini fill the form, the family confirms it
        v
Coordinator (src/lib/agent.ts)
        |  compatible group -> eligible -> in range -> nearest first
        v
Wave of donors on WhatsApp (5, 15, 40, 100, then 300 km)
        |  YES: family gets the donor, donor gets the contact
        |  all NO or timeout: next wave
        v
Every ring tried: send the family to eRaktKosh, keep accepting late replies
```

- **Gemini never makes a medical decision.** It only reads text. Blood compatibility and eligibility are plain code in `blood.ts` and `eligibility.ts`, and the family confirms what was read.
- **No background worker.** Each status poll runs `advanceRequest`, which is safe under concurrent polls.
- **Simulated donors cannot reach anyone.** Their numbers start `+91 10`, which is not a mobile prefix, and the code never sends them to Twilio.

## Answers for the judges

**Where do donors come from?** They opt in, through `/donate` and a first WhatsApp message. eRaktKosh has no public donor API that we could find, and WhatsApp requires opt-in anyway. The growth plan is blood donation camps, NSS units, colleges and NGOs already running donor groups.

**Why not just use eRaktKosh?** It is built around blood bank stock. We cover the gap when stock is not available or is too far away, and hand off to it when donors run out.

**How big is the problem?** The Health Ministry said in April 2026 that nearly 10% of districts have no blood centre ([source](https://medicaldialogues.in/amp/news/health/10-percent-of-districts-lack-blood-centre-health-ministry-flags-gaps-169246)). Don't quote "12% of districts over 100 km away": we found no source for it.

**Is it safe?** Compatibility is enforced in code, recently donated donors are excluded (90 days for men, 120 for women), and the blood centre does the final screening and cross-match.

**What about privacy?** Donors stay anonymous until they accept. They can reply `PAUSE`, or `STOP` to delete their details.

## Known limits

- Eligibility values come from public summaries. Check them against the current NBTC guidelines before real use.
- Compatibility covers red cells only, not platelets or plasma, and not rare types such as Bombay blood group.
- Anyone can create a request. It is limited per phone number, but real use needs phone verification for families.
- Production WhatsApp needs an approved message template for alerts beyond the 24-hour window.
- Donor location is one saved area, not live location.
# lifedrop
