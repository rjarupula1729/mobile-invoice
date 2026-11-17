# mobile-invoice

Mobile vegetable billing PWA — create invoices, share PDFs on WhatsApp, day sales and stock reports.

## License keys (one-time activation)

The app asks for an access key on first launch, then stays unlocked on that device.
`keys.json` stores only SHA-256 **hashes** — never the readable keys.

### Give a buyer a new key

```bash
node make-key.js
```

It prints two lines:

```
Key for buyer:                    VEG-XXXX-XXXX   <- send this to the buyer
Add to keys.json keys array:      "hash..."        <- paste into keys.json
```

Then:

1. Paste the hash into `keys.json` (inside the `keys` array, comma-separated)
2. `git add -A && git commit -m "Add key" && git push`
3. Note down: **key → buyer name → date** in your own records

### If you forget a key

Keys **cannot be recovered** — only hashes exist in the repo. If a buyer needs
their key again, run `node make-key.js`, give them the new key, and add its hash
to `keys.json` (you can leave or remove the old hash).

### Revoke a key

Delete its hash line from `keys.json` and push. New activations with that key
will fail. (Already-activated devices keep working — revoking live devices needs
a backend.)

### Disable activation entirely

Set `LICENSE_ENABLED = false` in `app.js` and push.
