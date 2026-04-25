"""
Playwright audit script — captures all API errors, console errors, and failed requests
across all authenticated pages of the Signal Hunter app.
"""
import json
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"

# Pages to audit (path, description)
PAGES = [
    ("/", "Command Center"),
    ("/scan", "Market Scan"),
    ("/scout", "Asset Scout"),
    ("/memos", "Investment Memos"),
    ("/outreach", "Outreach Pipeline"),
    ("/settings", "Settings"),
    ("/freedom-map", "Freedom Map"),
    ("/strategy-blender", "Strategy Blender"),
    ("/opportunity-radar", "Opportunity Radar"),
    ("/investor-dossier", "Investor Dossier"),
    ("/deal/5", "Deal Detail — Metro HVAC"),
]

results = {}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1280, "height": 900},
        # Use stored session cookie if available
    )
    
    # First: authenticate by navigating to the app and checking auth state
    page = context.new_page()
    
    # Collect all errors and failed requests
    all_errors = []
    
    for path, label in PAGES:
        print(f"\n{'='*60}")
        print(f"Auditing: {label} ({path})")
        print('='*60)
        
        page_errors = []
        api_errors = []
        failed_requests = []
        
        def on_console(msg):
            if msg.type in ("error", "warning"):
                text = msg.text
                # Filter out known stale esbuild errors
                if "13:01:40" in text or "17:05:34" in text:
                    return
                page_errors.append({
                    "type": msg.type,
                    "text": text[:300],
                    "url": msg.location.get("url", ""),
                })
        
        def on_response(response):
            if response.status >= 400:
                api_errors.append({
                    "status": response.status,
                    "url": response.url[:200],
                    "method": response.request.method,
                })
        
        def on_request_failed(request):
            failed_requests.append({
                "url": request.url[:200],
                "failure": request.failure,
            })
        
        page.on("console", on_console)
        page.on("response", on_response)
        page.on("requestfailed", on_request_failed)
        
        try:
            page.goto(f"{BASE_URL}{path}", timeout=15000)
            page.wait_for_load_state("networkidle", timeout=12000)
            time.sleep(2)  # Extra wait for tRPC queries to settle
            
            # Take screenshot
            screenshot_path = f"/tmp/audit_{label.replace(' ', '_').replace('/', '_')}.png"
            page.screenshot(path=screenshot_path, full_page=False)
            print(f"  Screenshot: {screenshot_path}")
            
        except Exception as e:
            page_errors.append({"type": "navigation_error", "text": str(e)})
        
        # Remove listeners for next page
        page.remove_listener("console", on_console)
        page.remove_listener("response", on_response)
        page.remove_listener("requestfailed", on_request_failed)
        
        results[label] = {
            "path": path,
            "console_errors": page_errors,
            "api_errors": api_errors,
            "failed_requests": failed_requests,
        }
        
        # Print summary
        if page_errors:
            print(f"  ❌ Console errors ({len(page_errors)}):")
            for e in page_errors[:5]:
                print(f"     [{e['type']}] {e['text'][:200]}")
        else:
            print(f"  ✅ No console errors")
            
        if api_errors:
            print(f"  ❌ API errors ({len(api_errors)}):")
            for e in api_errors[:5]:
                print(f"     [{e['status']}] {e['method']} {e['url'][:150]}")
        else:
            print(f"  ✅ No API errors")
            
        if failed_requests:
            print(f"  ⚠️  Failed requests ({len(failed_requests)}):")
            for r in failed_requests[:3]:
                print(f"     {r['url'][:150]} — {r['failure']}")
    
    browser.close()

# Final summary
print("\n" + "="*60)
print("AUDIT SUMMARY")
print("="*60)
total_console = sum(len(v["console_errors"]) for v in results.values())
total_api = sum(len(v["api_errors"]) for v in results.values())
total_failed = sum(len(v["failed_requests"]) for v in results.values())
print(f"Total console errors: {total_console}")
print(f"Total API errors (4xx/5xx): {total_api}")
print(f"Total failed requests: {total_failed}")

# Save full report
with open("/tmp/audit_report.json", "w") as f:
    json.dump(results, f, indent=2)
print("\nFull report saved to /tmp/audit_report.json")
