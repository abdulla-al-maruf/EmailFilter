<img width="1536" height="1024" alt="ChatGPT Image Apr 22, 2026, 01_48_03 PM" src="https://github.com/user-attachments/assets/517af995-1326-40a0-bb81-cfd2a5ff6c1a" />
# EmailFilter — Free Online Email Validator & Extractor Tool

**Extract valid email addresses from any messy text, CSV, or Excel file instantly — with real DNS/MX verification. No installation. No signup. 100% free.**

🔗 **Live Tool:** [https://abdulla-al-maruf.github.io/EmailFilter/](https://abdulla-al-maruf.github.io/EmailFilter/)

---

## What is EmailFilter?

EmailFilter is a free, browser-based email validation tool that helps you clean up messy email lists in seconds. Whether you have a text file full of random content, a CSV export from a CRM, or an Excel sheet with thousands of rows — EmailFilter automatically finds every email address, validates the format, and checks whether the domain actually exists using live DNS lookups.

No software to install. No server required. Everything runs directly in your browser.

This tool is perfect for:
- **Email marketers** cleaning up subscriber lists before a campaign
- **Developers** validating scraped or imported email data
- **Sales teams** verifying leads before outreach
- **Data analysts** deduplicating and cleaning contact databases
- **Anyone** who has a messy list and needs only the real, working emails

---

## Live Demo

Try it right now — no signup required:

👉 [https://abdulla-al-maruf.github.io/EmailFilter/](https://abdulla-al-maruf.github.io/EmailFilter/)

---

## Key Features

### Email Extraction
- Automatically scans any text and extracts all email-like patterns using regex
- Works on raw text, CSV files, Excel spreadsheets, and pasted content
- Removes duplicates automatically — same email is never processed twice

### Two-Layer Email Validation
1. **Format Validation** — checks RFC-compliant email structure (local part, domain, TLD rules, no double dots, length limits)
2. **DNS/MX Record Check** — queries Google's DNS-over-HTTPS API to verify the domain actually has mail servers configured

### Smart Status Classification
Every email gets one of three statuses:
- ✅ **Valid** — correct format AND domain has active MX records
- ❌ **Invalid** — malformed format OR domain has no MX records
- ⚠️ **Unverified** — correct format but DNS check timed out (5s limit)

### Supported Input Formats
| Format | Extension | Notes |
|--------|-----------|-------|
| Plain Text | `.txt` | Any text with mixed content |
| CSV | `.csv` | All columns scanned |
| Excel | `.xlsx` / `.xls` | All sheets, all columns |
| Paste | — | Paste directly into the tool |

### Results Dashboard
- Filter results by: All / Valid / Invalid / Unverified
- Search emails by address or domain name
- Paginated table — 50 results per page
- Donut chart showing valid/invalid/unverified breakdown
- Stats summary: total found, valid count, invalid count, unverified count

### Export Options
- Download valid emails as **CSV** (with domain column)
- Download valid emails as **TXT** (one email per line)
- Copy any single email to clipboard with one click

### Performance
- Domain caching — same domain is only queried once (big speed improvement for large lists)
- Batch processing — 8 concurrent DNS requests at a time
- Progress bar with live status updates during validation

---

## How to Use

### Option 1 — Use Online (Recommended)
Simply open the tool in your browser:
[https://abdulla-al-maruf.github.io/EmailFilter/](https://abdulla-al-maruf.github.io/EmailFilter/)

No download, no signup, works on any device.

### Option 2 — Run Locally (Offline)
1. Download or clone this repository
2. Open `index.html` in any modern browser
3. The tool works fully offline — except DNS/MX checks require internet

```bash
git clone https://github.com/abdulla-al-maruf/EmailFilter.git
cd EmailFilter
# Open index.html in your browser
```

---

## How It Works (Step by Step)

```
1. INPUT
   Upload TXT / CSV / XLSX  ──or──  Paste raw text

2. EXTRACT
   Regex scans entire content → finds all email-like strings
   Deduplicates → removes exact duplicates

3. FORMAT CHECK
   RFC-compliant validation:
   • Max 254 characters total
   • Local part max 64 characters
   • No leading/trailing/double dots
   • Valid domain structure with TLD

4. DNS / MX CHECK (requires internet)
   Google DNS-over-HTTPS API:
   https://dns.google/resolve?name=domain.com&type=MX
   → Status 0 + Answer present = domain has mail servers = Valid
   → No answer = domain has no MX records = Invalid
   → Timeout (5s) = Unverified

5. RESULTS
   Table with status badges + stats dashboard

6. EXPORT
   Download valid emails as CSV or TXT
```

---

## Email Validation Rules

### Format Validation (Offline)
| Rule | Example |
|------|---------|
| Must contain exactly one `@` | `user@domain.com` ✅ |
| Local part max 64 characters | `a`×65`@domain.com` ❌ |
| Total max 254 characters | — |
| No consecutive dots | `user..name@domain.com` ❌ |
| No leading or trailing dot | `.user@domain.com` ❌ |
| Valid TLD (min 2 chars) | `user@domain.c` ❌ |
| No special characters in domain | `user@dom!ain.com` ❌ |

### MX Record Validation (Online)
Checks if the email's domain has mail exchange (MX) records configured in DNS. A domain without MX records cannot receive email — even if the format looks correct.

Examples:
- `user@gmail.com` → gmail.com has MX records → ✅ Valid
- `user@notarealdomain12345.com` → no MX records → ❌ Invalid
- `user@slowdomain.xyz` → DNS timeout → ⚠️ Unverified

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML5 | Structure |
| CSS3 | Styling (no framework) |
| Vanilla JavaScript | All logic |
| [SheetJS (xlsx.js)](https://sheetjs.com/) v0.18.5 | Excel file parsing |
| [Google DNS-over-HTTPS](https://developers.google.com/speed/public-dns/docs/doh) | Live MX record lookup |

**Zero dependencies installed.** Everything runs in the browser. SheetJS is loaded via CDN.

---

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full support |
| Firefox 90+ | ✅ Full support |
| Edge 90+ | ✅ Full support |
| Safari 14+ | ✅ Full support |
| Mobile browsers | ✅ Responsive layout |

---

## Privacy

- **No data is sent to any server** (except domain names to Google DNS for MX lookups)
- Your email list never leaves your browser
- No analytics, no tracking, no cookies
- Works fully offline except for DNS/MX checks

---

## Use Cases

### Clean Email Marketing Lists
Before sending a campaign, run your subscriber list through EmailFilter to remove invalid addresses. Reduce bounce rates and protect your sender reputation.

### Validate Scraped Data
Scraped email lists contain a lot of garbage. Paste the raw output into EmailFilter and get only real, deliverable addresses in seconds.

### Verify CRM Exports
Export your CRM contacts, upload the CSV, and identify which emails are no longer valid.

### Deduplicate Contact Lists
Merged lists often have duplicates. EmailFilter removes them automatically.

### Developer Testing
Quickly check whether a batch of email addresses from user registration data are valid before processing them in your backend.

---

## FAQ

**Is this tool really free?**
Yes, completely free. No signup, no credit card, no limits.

**Does it work without internet?**
Format validation works offline. DNS/MX checks require internet access to query Google's DNS servers.

**How large a list can I process?**
There is no hard limit. The tool handles thousands of emails. Very large lists (10,000+) may take a few minutes due to DNS lookups.

**Are my emails safe?**
Your email list never leaves your browser. Only domain names (not email addresses) are sent to Google DNS to check MX records.

**What does "Unverified" mean?**
The email format is valid, but the DNS check timed out (5 seconds). The domain may be slow or temporarily unreachable. These emails might be valid — treat them with caution.

**Can I use this on mobile?**
Yes, the layout is responsive and works on mobile browsers.

**Can I self-host this?**
Yes — it's a single HTML file. Download it and open it in any browser, or host it on any static hosting service.

---

## Contributing

Contributions are welcome! If you have ideas for improvements or find a bug:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Submit a pull request

---

## License

This project is licensed under the **MIT License** — free to use, modify, and distribute.

See [LICENSE](LICENSE) for full details.

---

## Author

**Abdulla Al Maruf**
GitHub: [@abdulla-al-maruf](https://github.com/abdulla-al-maruf)

---

*If this tool saved you time, consider giving it a ⭐ star on GitHub — it helps others find it!*
