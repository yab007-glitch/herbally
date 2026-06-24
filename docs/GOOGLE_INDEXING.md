# Google Indexing Setup Guide

This guide will help you get HerbAlly indexed by Google and other search engines.

## Step 1: Google Search Console Setup

### 1.1 Add Property

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Click **"Add Property"** or **"Add a Resource"**
3. Enter: `herbally.app`
4. Click **Continue**

### 1.2 Verify Ownership (Choose ONE method)

#### Option A: DNS Verification (Recommended)

1. In Search Console, select **"DNS record"** verification
2. Copy the TXT record value (looks like: `google-site-verification=AbCdEfGhIjK...`)
3. Go to your domain registrar (where you bought herbally.app)
4. Find DNS settings for herbally.app
5. Add a new TXT record:
   - **Type:** TXT
   - **Name/Host:** @ (or leave blank)
   - **Value:** Paste the Google verification code
   - **TTL:** 3600 (or default)
6. Save and wait 5-60 minutes
7. Return to Search Console and click **"Verify"**

#### Option B: HTML File Verification

1. In Search Console, select **"Upload an HTML file"**
2. Download the verification file (e.g., `google1234567890abcdef.html`)
3. Place it in: `/public/google1234567890abcdef.html`
4. Deploy the change
5. Verify the file loads: `https://herbally.app/google1234567890abcdef.html`
6. Return to Search Console and click **"Verify"**

#### Option C: HTML Meta Tag

1. In Search Console, select **"HTML tag"**
2. Copy the content value (e.g., `AbCdEfGhIjKlMnOp...`)
3. Edit `src/app/layout.tsx`:
   ```typescript
   verification: {
     google: "AbCdEfGhIjKlMnOp...",  // Replace YOUR_CODE_HERE
   },
   ```
4. Deploy and verify
5. Return to Search Console and click **"Verify"**

### 1.3 Submit Sitemap

1. In Search Console, go to **Sitemaps** (left sidebar)
2. Enter: `sitemap.xml`
3. Click **Submit**
4. Wait for "Success" confirmation

### 1.4 Request Indexing for Key Pages

1. Go to **URL Inspection** (top search bar)
2. Enter these URLs one by one:
   - `https://herbally.app`
   - `https://herbally.app/herbs`
   - `https://herbally.app/calculator`

- `https://herbally.app/pharmacist`
- `https://herbally.app/herbalist`
- `https://herbally.app/herbs/turmeric`
- `https://herbally.app/herbs/chamomile`
- `https://herbally.app/herbs/ginger`
- `https://herbally.app/herbs/lavender`
- `https://herbally.app/herbs/echinacea`

3. For each URL:
   - Click **"Request Indexing"**
   - Wait for confirmation

---

## Step 2: Bing Webmaster Tools

### 2.1 Add Site

1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. Sign in with Microsoft account or Google account
3. Add site: `herbally.app`

### 2.2 Verify Ownership

1. Choose **"Meta tag"** verification
2. Copy the verification code
3. Edit `src/app/layout.tsx`:
   ```typescript
   other: {
     "msvalidate.01": "YOUR_BING_CODE_HERE",
   },
   ```
4. Deploy and verify

### 2.3 Submit Sitemap

1. Go to **Sitemaps**
2. Add: `https://herbally.app/sitemap.xml`

---

## Step 3: IndexNow (Fast Indexing)

We've set up IndexNow support. To activate:

1. The key file is already created at: `public/herbally-indexnow-key-1775527694.txt`
2. After deploying, test: `https://herbally.app/herbally-indexnow-key-1775527694.txt`
3. Submit to IndexNow:
   ```
   https://api.indexnow.org/indexnow?url=https://herbally.app&key=herbally-indexnow-key-1775527694
   ```

---

## Step 4: Monitor Progress

### Google Search Console

- Check **Coverage** report weekly
- Look for errors or warnings
- Monitor **Performance** for impressions/clicks

### Expected Timeline

| Time      | What to Expect           |
| --------- | ------------------------ |
| 24-48h    | Homepage indexed         |
| 3-7 days  | Main pages indexed       |
| 1-4 weeks | All herbs indexed        |
| 2-8 weeks | Ranking starts appearing |

---

## Quick Checklist

- [ ] Add property in Google Search Console
- [ ] Verify ownership (DNS, HTML file, or meta tag)
- [ ] Submit sitemap (`sitemap.xml`)
- [ ] Request indexing for homepage
- [ ] Request indexing for `/herbs` page
- [ ] Request indexing for 5-10 popular herb pages
- [ ] Add Bing Webmaster Tools
- [ ] Verify Bing ownership
- [ ] Submit sitemap to Bing
- [ ] Test IndexNow key file

---

## Files Modified

```
src/app/layout.tsx          - Added verification placeholders
public/indexnow-key.txt     - IndexNow API key
public/herbally-indexnow-*.txt - IndexNow verification
```

After getting verification codes, update `layout.tsx` and redeploy.
