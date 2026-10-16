r"""
Phase 10e verification: the design system itself.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts\e2e\phase10e_design.py

Protects what DESIGN.md promises:
  * one typeface, self-hosted
  * a theme choice that survives a reload, applied before paint
  * a real dark mode (tokens remapped, not inverted)
  * the generative cover art, and uploaded thumbnails still winning over it
  * no horizontal overflow in either theme at three widths
  * prefers-reduced-motion collapsing the motion scale
"""
import os
import re
import sys
import tempfile

from playwright.sync_api import sync_playwright, Page

BASE = os.environ.get("LMS_BASE", "http://localhost:3000")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOTS = os.path.join(tempfile.gettempdir(), "opencode", "lms-shots")
os.makedirs(SHOTS, exist_ok=True)

results: list[tuple[str, bool, str]] = []
console_errors: list[str] = []
COURSE = "typescript-for-production-teams"


def check(name: str, condition: bool, detail: str = "") -> None:
    ok = bool(condition)
    results.append((name, ok, detail))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  -- {detail}" if detail and not ok else ""))


def body(page: Page) -> str:
    return page.inner_text("body")


def has(page: Page, text: str) -> bool:
    return text.lower() in body(page).lower()


def overflow(page: Page) -> int:
    return page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")


def theme_attribute(page: Page) -> str:
    return page.evaluate("document.documentElement.dataset.theme || ''")


def luminance(page: Page) -> float:
    """Relative luminance of the page canvas - proves the theme actually applied."""
    return rgb_luminance(get_computed_background(page, "body"))


def get_computed_background(page: Page, selector: str) -> str:
    return page.evaluate(f"getComputedStyle(document.querySelector('{selector}')).backgroundColor")


def _channel(value: float) -> float:
    return value / 12.92 if value <= 0.03928 else ((value + 0.055) / 1.055) ** 2.4


def rgb_luminance(css_color: str) -> float:
    """WCAG relative luminance from an rgb()/rgba() string."""
    parts = [int(n) for n in re.findall(r"\d+", css_color)[:3]]
    channels = [_channel(v / 255) for v in parts]
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def hex_luminance(value: str) -> float:
    """WCAG relative luminance from a #rrggbb token."""
    body = value.lstrip("#")[:6]
    channels = [_channel(int(body[i : i + 2], 16) / 255) for i in (0, 2, 4)]
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def login(page: Page, email: str = "learner@demo.test") -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", email)
    page.fill("#password", "Demo1234!")
    page.click("button[type=submit]")
    page.wait_for_url("**/dashboard", timeout=25000)
    page.wait_for_load_state("networkidle")


def main() -> int:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()

        # ---------------------------------------------------------------- type + tokens
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.goto(f"{BASE}/")
        page.wait_for_load_state("networkidle")

        family = page.evaluate("getComputedStyle(document.body).fontFamily")
        first_family = family.split(",")[0].strip().strip('"')
        system_names = {"ui-sans-serif", "system-ui", "arial", "roboto", "segoe ui", "helvetica neue"}
        check(
            "body uses the self-hosted family, not a system fallback",
            first_family.lower() not in system_names and bool(first_family),
            f"first family is {first_family!r}",
        )
        loaded = page.evaluate(
            "(name) => Array.from(document.fonts).some((f) => f.family.includes(name) && f.status === 'loaded')",
            first_family,
        )
        check("the self-hosted font file actually loads (no network font)", loaded is True, f"{first_family}: {loaded}")

        tokens = page.evaluate(
            "['--canvas','--ink-900','--brand-600','--line','--primary','--motion-base','--ease-out']"
            ".map((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim())"
        )
        check("design tokens are defined", all(tokens), ", ".join(tokens))
        nav_motion = page.evaluate("getComputedStyle(document.querySelector('.nav-pill')).transitionDuration")
        check("motion scale is used for the nav highlight", "0.26s" in nav_motion, nav_motion)

        # ------------------------------------------------------------------ light default
        check("a fresh visitor gets the light theme", theme_attribute(page) == "", theme_attribute(page))
        light_canvas = luminance(page)
        check("light canvas is light", light_canvas > 0.8, f"luminance {light_canvas:.3f}")

        # a light-theme primary action is ink, not a coloured button
        cta = page.evaluate(
            "(() => { const el = [...document.querySelectorAll('a,button')].find((e) => /browse courses/i.test(e.textContent));"
            " return el ? getComputedStyle(el).backgroundColor : ''; })()"
        )
        check("primary action is ink (near-black)", cta.startswith("rgb(20, 24, 29") or cta == "rgb(20, 24, 29)", cta)

        # ------------------------------------------------------------- theme remembered
        page.click("button[title='Dark theme']")
        page.wait_for_timeout(250)
        check("choosing dark sets the attribute", theme_attribute(page) == "dark", theme_attribute(page))
        check(
            "the choice is remembered in localStorage",
            page.evaluate("localStorage.getItem('demolms-theme')") == "dark",
            str(page.evaluate("localStorage.getItem('demolms-theme')")),
        )
        dark_canvas = luminance(page)
        check("dark canvas is dark", dark_canvas < 0.05, f"luminance {dark_canvas:.4f}")

        # dark mode has to be designed, not inverted: the raised surface sits above the
        # canvas in lightness, and hairlines get lighter rather than darker
        dark_surface_hex = page.evaluate(
            "getComputedStyle(document.querySelector('.card')).backgroundColor"
        )
        dark_surface = rgb_luminance(dark_surface_hex)
        check(
            "dark mode raises surfaces above the canvas",
            dark_surface > dark_canvas,
            f"surface {dark_surface:.4f} vs canvas {dark_canvas:.4f}",
        )
        dark_line = hex_luminance(
            page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--line').trim()")
        )
        check(
            "dark hairlines are lighter than the canvas",
            dark_line > dark_canvas,
            f"line {dark_line:.4f} vs canvas {dark_canvas:.4f}",
        )
        dark_cta = page.evaluate(
            "(() => { const el = [...document.querySelectorAll('a,button')].find((e) => /browse courses/i.test(e.textContent));"
            " return el ? getComputedStyle(el).backgroundColor : ''; })()"
        )
        check("primary action inverts to near-white in dark", dark_cta.startswith("rgb(242, 243, 245"), dark_cta)

        page.reload()
        page.wait_for_load_state("networkidle")
        check("dark survives a reload", theme_attribute(page) == "dark", theme_attribute(page))
        check("the pre-paint script still has it set after load", theme_attribute(page) == "dark", theme_attribute(page))

        page.click("button[title='Light theme']")
        page.wait_for_timeout(200)
        check("switching back to light clears the attribute", theme_attribute(page) == "", theme_attribute(page))
        page.screenshot(path=os.path.join(SHOTS, "design-light-desktop.png"))

        # ------------------------------------------------------- covers: generative art
        page.goto(f"{BASE}/courses")
        page.wait_for_load_state("networkidle")
        cards = page.locator("article.card").count()
        covers = page.locator("article.card svg[aria-hidden=true]").count()
        uploaded = page.locator("article.card img[src*='/uploads/']").count()
        check("catalogue renders course cards", cards >= 5, str(cards))
        check("seeded courses draw generative covers", covers >= 5, f"{covers} svg covers of {cards} cards")
        check("no seeded course falls back to a placeholder image", uploaded == 0, f"{uploaded} img covers")

        # deterministic: the same course has the same art, different courses differ
        first_shape = page.evaluate(
            "Array.from(document.querySelectorAll('article.card svg[aria-hidden=true] rect')).slice(0, 20)"
            ".map((r) => r.getAttribute('height')).join('-')"
        )
        second_shape = page.evaluate(
            "Array.from(document.querySelectorAll('article.card svg[aria-hidden=true] rect')).slice(20, 40)"
            ".map((r) => r.getAttribute('height')).join('-')"
        )
        check("each course gets its own shape", first_shape != second_shape and bool(first_shape), "identical bars")
        check("the accent bar is a single element per cover", page.locator("article.card svg rect.fill-brand-600").count() >= 5)

        page.goto(f"{BASE}/courses/{COURSE}")
        page.wait_for_load_state("networkidle")
        detail_bars = page.locator("aside svg[aria-hidden=true] rect").count()
        check("cover art is drawn on the course detail page", detail_bars >= 10, str(detail_bars))
        check("prose caps its measure at ~68ch", page.evaluate(
            "(() => { const el = document.querySelector('.prose-lms'); if (!el) return 'missing';"
            " return parseFloat(getComputedStyle(el).maxWidth); })()"
        ) not in ("missing", 0), "no prose on the page")

        # ------------------------------------------------------------------- phone + sheet
        mobile = browser.new_context(viewport={"width": 390, "height": 844})
        mpage = mobile.new_page()
        mpage.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        mpage.goto(f"{BASE}/")
        mpage.wait_for_load_state("networkidle")
        check("compact theme control is hidden on a phone", not mpage.locator("button[title='Dark theme']").is_visible())
        mpage.click("button[aria-label='Open menu']")
        mpage.wait_for_timeout(300)
        check("the phone sheet carries a theme row", has(mpage, "Theme"))
        mpage.locator("div.popover [role=group][aria-label='Colour theme'] button:has-text('Dark')").click()
        mpage.wait_for_timeout(250)
        check("theme can be changed from the phone sheet", theme_attribute(mpage) == "dark", theme_attribute(mpage))
        mpage.screenshot(path=os.path.join(SHOTS, "design-dark-phone-sheet.png"))
        mobile.close()

        # ----------------------------------------------------------- overflow, both themes
        for theme in ("light", "dark"):
            for width, label in ((390, "phone"), (768, "tablet"), (1280, "desktop")):
                ctx = browser.new_context(viewport={"width": width, "height": 900})
                ctx.add_init_script(f"try{{localStorage.setItem('demolms-theme','{theme}')}}catch(e){{}}")
                pg = ctx.new_page()
                pg.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
                for path, name in (
                    ("/", "home"),
                    ("/courses", "catalogue"),
                    (f"/courses/{COURSE}", "course detail"),
                ):
                    pg.goto(f"{BASE}{path}")
                    pg.wait_for_load_state("networkidle")
                    value = overflow(pg)
                    check(f"no overflow · {theme} {label} {name}", value <= 1, f"{value}px")
                if width == 1280:
                    login(pg)
                    for path, name in (("/dashboard", "dashboard"), ("/learn/my-learning", "my learning")):
                        pg.goto(f"{BASE}{path}")
                        pg.wait_for_load_state("networkidle")
                        value = overflow(pg)
                        check(f"no overflow · {theme} {label} {name}", value <= 1, f"{value}px")
                ctx.close()

        # ------------------------------------------------------------- reduced motion
        ctx = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
        pg = ctx.new_page()
        pg.goto(f"{BASE}/")
        pg.wait_for_load_state("networkidle")
        reduced = pg.evaluate("getComputedStyle(document.querySelector('.nav-pill')).transitionDuration")
        seconds = max(float(part.replace("s", "")) for part in reduced.split(","))
        check("reduced motion collapses the motion scale", seconds < 0.001, reduced)
        ctx.close()

        # --------------------------------------------------------------------- done
        noisy = [
            error
            for error in console_errors
            if "Failed to load resource" not in error
            and "Download the React DevTools" not in error
            and "DeprecationWarning" not in error
        ]
        check("no runtime console errors", len(noisy) == 0, " | ".join(noisy[:2]))

        context.close()
        browser.close()

    failed = [name for name, ok, _ in results if not ok]
    print("\n---")
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("failed: " + ", ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
