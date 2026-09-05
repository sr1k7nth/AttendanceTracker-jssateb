from playwright.sync_api import sync_playwright

PORTAL_URL = "https://jssateb.azurewebsites.net/Apps/Login.aspx"


class LoginError(Exception):
    pass


def verify_register(usn: str, password: str):
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            page = browser.new_page()
            page.goto(PORTAL_URL, wait_until="domcontentloaded")
            page.wait_for_selector("#optLoginAsStudent", timeout=15000)
            page.check("#optLoginAsStudent")
            page.fill("#txtUserID", usn)
            page.fill("#txtPassword", password)
            page.click("#myBtn")

            try:
                page.wait_for_load_state("domcontentloaded", timeout=15000)
            except TimeoutError:
                pass

            error_box = page.query_selector("#divModelValidation_alertmsg")
            if error_box:
                msg = error_box.inner_text().strip().lower()
                if "incorrect user id" in msg or "password" in msg:
                    raise LoginError("Invalid credentials")

            return True

        except LoginError:
            return False

        finally:
            browser.close()


if __name__ == "__main__":
    result = verify_register("JS240955", "Srikanth02av$")
    print(result)
