# Google Maps production setup

Phase 0 Step 5 separates browser and server Google Maps credentials, wires the
browser values into the Next.js build, applies the configured JavaScript map ID
to the 3D preview, and makes deployed configuration fail fast when required
values are missing or obvious placeholders.

The repository cannot create or inspect the real Google Cloud resources without
the target project, deployment origins, stable backend egress addresses, and an
authorized Google Cloud session. Complete the cloud checklist below for staging
and production before declaring Step 5 operationally complete.

## Credential boundary

Use different keys for the two trust boundaries:

| Credential | Application restriction | Initial API restriction | Delivery |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Websites/HTTP referrers | Maps JavaScript API + Places API (New) | Next.js build argument; visible in browser code by design |
| `GOOGLE_MAPS_SERVER_KEY` | Public egress IP addresses/CIDR | Geocoding API when server geocoding is enabled | Backend runtime secret only |

Do not authorize server APIs such as Geocoding or Routes on the browser key.
The guided landlord location picker now uses Places API (New), so the browser
key requires it alongside Maps JavaScript API. Add Routes API to the server key
only when the P1 routes feature is implemented.

## Google Cloud checklist

Repeat this setup in separate staging and production projects or, at minimum,
with separate keys, quotas, data, and deployment configuration.

1. Select the target Google Cloud project and attach an approved billing
   account.
2. Enable Maps JavaScript API and Places API (New). Enable Geocoding API only
   when the backend uses it, and Routes API only for implemented features.
3. Create a JavaScript map ID in Maps Management and associate the intended 3D
   style. The map ID and browser key must belong to the same project.
4. Create the browser key with both restrictions:
   - application restriction: Websites;
   - allowed referrers: the exact HTTPS staging/production origins, both the
     bare origin and its `/*` path form where required;
   - API restriction: Maps JavaScript API and Places API (New).
5. Create the server key with both restrictions:
   - application restriction: the backend's stable public egress IP addresses
     or CIDR ranges. Private IPs and localhost are not valid restrictions;
   - API restriction: only the server-side Maps APIs currently used.
6. Configure per-API quotas and billing-budget alerts appropriate for staging
   and production. Budget alerts notify; they are not a hard spending cap.
7. Store the server key in the deployment secret manager. Store the browser key
   and map ID as protected build configuration. Never commit any credential.

For local development, use a separate browser key restricted to
`http://localhost:3000` and `http://localhost:3000/*`, or leave both browser
values empty to exercise the accessible static 2D/list fallback. Do not add
localhost to staging or production keys.

## Build and runtime wiring

`NEXT_PUBLIC_*` values are frozen into the client bundle by Next.js during the
build. They must be passed to the frontend image builder, not added only to the
running container.

```bash
docker build \
  --file deploy-part/docker/frontend.Dockerfile \
  --build-arg APP_ENV=production \
  --build-arg NEXT_PUBLIC_API_BASE_URL="$NEXT_PUBLIC_API_BASE_URL" \
  --build-arg NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY="$NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY" \
  --build-arg NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID="$NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID" \
  .
```

The backend receives `GOOGLE_MAPS_SERVER_KEY` only at runtime. Staging and
production startup reject an absent or obvious placeholder value. Local and
test environments may omit it because no server-side Maps integration is used
yet.

The local Compose stack forwards optional shell values into the correct build
and runtime boundaries:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=... \
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=... \
GOOGLE_MAPS_SERVER_KEY=... \
docker compose -f deploy-part/compose.local.yaml up --build
```

## Verification gate

Before production release:

1. Inspect both credentials in Google Cloud and confirm that each has one
   application restriction and the minimum API allowlist described above.
2. Confirm the two key strings are different.
3. Build with `APP_ENV=production`; missing browser key/map ID must fail the
   frontend build, and a missing server key must stop backend startup.
4. Open the deployed landing page from every allowed origin and confirm the 3D
   preview uses the configured map ID.
5. Open `/landlord/listings/new` with an authorized Landlord and confirm address
   autocomplete, map click, and keyboard-draggable marker changes update the
   private coordinates.
6. Open the same bundle from an unlisted origin and confirm Google rejects the
   request while FindMe retains its labelled 2D/list fallback.
7. Test reduced motion and a blocked Maps request. Discovery and rental status
   must remain understandable without 3D rendering or color alone.
8. Review Google Maps metrics by credential and verify that traffic appears
   only on the intended key and API.

Current official references:

- https://developers.google.com/maps/api-security-best-practices
- https://developers.google.com/maps/documentation/javascript/load-maps-js-api
- https://developers.google.com/maps/documentation/javascript/map-ids/get-map-id
- https://developers.google.com/maps/documentation/javascript/3d/best-practices
- https://docs.cloud.google.com/docs/authentication/api-keys
